#!/usr/bin/env node

/**
 * Fiverr Project Assistant CLI
 * AI-powered assistant for managing Fiverr project conversations
 */

import { program } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { readFileSync, existsSync, copyFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';

import {
  loadKnowledgeBase,
  addToKnowledgeBase,
  getKnowledgeStats,
  deleteKnowledgeEntry,
  updateKnowledgeEntry,
  searchEntries,
  loadIgnoredUsers,
  removeIgnoredUser
} from './knowledge.js';

import { search } from './search.js';

import {
  processConversation,
  getSuggestedResponse,
  findConversationFiles,
  batchProcessConversations,
  formatConversation,
  loadConversation
} from './processor.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Check for config file
function checkConfig() {
  const configPath = join(__dirname, 'config.json');
  if (!existsSync(configPath)) {
    console.log(chalk.yellow('\n⚠️  No config.json found!'));
    console.log(chalk.white('Please copy config.example.json to config.json and add your API keys.\n'));
    console.log(chalk.gray(`  cp ${join(__dirname, 'config.example.json')} ${configPath}\n`));
    process.exit(1);
  }
}

program
  .name('fiverr-assistant')
  .description('AI-powered assistant for managing Fiverr project conversations')
  .version('1.0.0');

// ============ STATS COMMAND ============
program
  .command('stats')
  .description('Show knowledge base statistics')
  .action(() => {
    const stats = getKnowledgeStats();
    console.log(chalk.cyan('\n📊 Knowledge Base Statistics\n'));
    console.log(chalk.white(`  Total Q&A Entries:        ${chalk.green(stats.totalEntries)}`));
    console.log(chalk.white(`  Processed Conversations:  ${chalk.green(stats.processedConversations)}`));
    console.log(chalk.white(`  Scoped Conversations:     ${chalk.green(stats.scopedConversations)}`));
    console.log(chalk.white(`  Ignored Users:            ${chalk.yellow(stats.ignoredUsers)}`));
    console.log();
  });

// ============ LIST COMMAND ============
program
  .command('list')
  .description('List all entries in the knowledge base')
  .option('-l, --limit <number>', 'Limit number of entries shown', '20')
  .option('-s, --search <query>', 'Filter entries by search query')
  .action((options) => {
    let entries = loadKnowledgeBase();
    
    if (options.search) {
      entries = searchEntries(options.search);
      console.log(chalk.cyan(`\n🔍 Search results for "${options.search}":\n`));
    } else {
      console.log(chalk.cyan('\n📚 Knowledge Base Entries:\n'));
    }

    const limit = parseInt(options.limit);
    entries.slice(0, limit).forEach((entry, i) => {
      console.log(chalk.white(`${i + 1}. ${chalk.yellow('Q:')} ${entry.question.substring(0, 80)}${entry.question.length > 80 ? '...' : ''}`));
      console.log(chalk.gray(`   ${chalk.green('A:')} ${entry.answer.substring(0, 80)}${entry.answer.length > 80 ? '...' : ''}`));
      console.log(chalk.gray(`   ID: ${entry.id} | Source: ${entry.source || 'unknown'}`));
      console.log();
    });

    if (entries.length > limit) {
      console.log(chalk.gray(`  ... and ${entries.length - limit} more entries\n`));
    }
  });

// ============ ADD COMMAND ============
program
  .command('add')
  .description('Manually add a Q&A entry to the knowledge base')
  .action(async () => {
    checkConfig();
    
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'question',
        message: 'Enter the question:',
        validate: (input) => input.length > 0 || 'Question cannot be empty'
      },
      {
        type: 'editor',
        name: 'answer',
        message: 'Enter the answer:'
      }
    ]);

    console.log(chalk.cyan('\n⏳ Checking for duplicates...\n'));
    
    const result = await addToKnowledgeBase(
      { question: answers.question, answer: answers.answer },
      { source: 'manual' }
    );

    if (result.added) {
      console.log(chalk.green('✅ Entry added successfully!'));
      console.log(chalk.gray(`   ID: ${result.entry.id}\n`));
    } else {
      console.log(chalk.yellow(`⚠️  ${result.reason}`));
      if (result.duplicate) {
        console.log(chalk.gray(`   Similar entry: ${result.duplicate.question.substring(0, 60)}...\n`));
      }
    }
  });

// ============ PROCESS COMMAND ============
program
  .command('process <path>')
  .description('Process a conversation file or directory to learn Q&A pairs')
  .option('-d, --dry-run', 'Preview what would be extracted without saving')
  .option('--in-scope', 'Mark all conversations as in-scope')
  .option('--out-of-scope', 'Mark all conversations as out-of-scope')
  .action(async (path, options) => {
    checkConfig();
    
    const resolvedPath = resolve(path);
    
    if (!existsSync(resolvedPath)) {
      console.log(chalk.red(`\n❌ Path not found: ${resolvedPath}\n`));
      process.exit(1);
    }

    // Determine scope forcing
    let forceScope = null;
    if (options.inScope) forceScope = true;
    if (options.outOfScope) forceScope = false;

    // Check if it's a file or directory
    const stat = (await import('fs')).statSync(resolvedPath);
    
    if (stat.isFile()) {
      // Process single file
      console.log(chalk.cyan(`\n📄 Processing conversation: ${resolvedPath}\n`));
      
      const result = await processConversation(resolvedPath, {
        forceScope,
        dryRun: options.dryRun
      });

      displayProcessResult(result, options.dryRun);
      
      // If scope needs manual input
      if (result.isInScope === null && !options.dryRun) {
        const scopeAnswer = await inquirer.prompt([{
          type: 'confirm',
          name: 'inScope',
          message: `Is this conversation about your current project?`,
          default: true
        }]);
        
        // Re-process with scope set
        const finalResult = await processConversation(resolvedPath, {
          forceScope: scopeAnswer.inScope,
          dryRun: false
        });
        
        displayProcessResult(finalResult, false);
      }
    } else {
      // Process directory
      console.log(chalk.cyan(`\n📁 Scanning directory: ${resolvedPath}\n`));
      
      const files = findConversationFiles(resolvedPath);
      console.log(chalk.white(`   Found ${files.length} conversation files\n`));

      if (files.length === 0) {
        console.log(chalk.yellow('   No conversation files found.\n'));
        return;
      }

      // Ask for scope if not forced and not enough entries
      const stats = getKnowledgeStats();
      if (forceScope === null && stats.totalEntries < 20) {
        console.log(chalk.yellow(`   ⚠️  Knowledge base has only ${stats.totalEntries} entries (need 20 for auto-scope detection)\n`));
        
        const scopeAnswer = await inquirer.prompt([{
          type: 'list',
          name: 'scopeChoice',
          message: 'How would you like to handle scope detection?',
          choices: [
            { name: 'Mark all as in-scope', value: 'in' },
            { name: 'Mark all as out-of-scope', value: 'out' },
            { name: 'Ask for each conversation', value: 'ask' }
          ]
        }]);

        if (scopeAnswer.scopeChoice === 'in') forceScope = true;
        else if (scopeAnswer.scopeChoice === 'out') forceScope = false;
        else {
          // Process one by one with prompts
          for (const file of files) {
            console.log(chalk.cyan(`\n📄 Processing: ${file.username}\n`));
            
            // Show preview
            const convData = loadConversation(file.path);
            const preview = formatConversation(convData).substring(0, 500);
            console.log(chalk.gray(preview + (preview.length >= 500 ? '...' : '')));
            
            const answer = await inquirer.prompt([{
              type: 'confirm',
              name: 'inScope',
              message: `Is this conversation in scope for your project?`,
              default: true
            }]);

            const result = await processConversation(file.path, {
              forceScope: answer.inScope,
              dryRun: options.dryRun
            });
            
            displayProcessResult(result, options.dryRun);
          }
          return;
        }
      }

      // Batch process
      console.log(chalk.cyan('⏳ Processing conversations...\n'));
      
      const results = await batchProcessConversations(files, {
        forceScope,
        dryRun: options.dryRun
      });

      console.log(chalk.cyan('\n📊 Batch Processing Results:\n'));
      console.log(chalk.white(`   Processed:           ${chalk.green(results.processed)}`));
      console.log(chalk.white(`   In-Scope:            ${chalk.green(results.inScope)}`));
      console.log(chalk.white(`   Out-of-Scope:        ${chalk.yellow(results.outOfScope)}`));
      console.log(chalk.white(`   Skipped (ignored):   ${chalk.gray(results.skipped)}`));
      console.log(chalk.white(`   Q&A Extracted:       ${chalk.green(results.totalQAExtracted)}`));
      console.log(chalk.white(`   Q&A Added:           ${chalk.green(results.totalQAAdded)}`));
      
      if (results.errors.length > 0) {
        console.log(chalk.red(`   Errors:              ${results.errors.length}`));
        results.errors.forEach(e => console.log(chalk.red(`     - ${e.file}: ${e.error}`)));
      }
      console.log();
    }
  });

// ============ SUGGEST COMMAND ============
program
  .command('suggest <conversation>')
  .description('Generate a suggested response for a conversation')
  .action(async (conversationPath) => {
    checkConfig();
    
    const resolvedPath = resolve(conversationPath);
    
    if (!existsSync(resolvedPath)) {
      console.log(chalk.red(`\n❌ File not found: ${resolvedPath}\n`));
      process.exit(1);
    }

    console.log(chalk.cyan('\n⏳ Analyzing conversation and generating response...\n'));
    
    try {
      const result = await getSuggestedResponse(resolvedPath);
      
      if (result.error) {
        console.log(chalk.red(`❌ ${result.error}\n`));
        return;
      }

      console.log(chalk.yellow('📩 Last Message:'));
      console.log(chalk.gray(`   From: ${result.lastMessage.sender}`));
      console.log(chalk.gray(`   Time: ${result.lastMessage.time}`));
      console.log(chalk.white(`   "${result.lastMessage.body}"\n`));

      if (result.relevantKnowledge.length > 0) {
        console.log(chalk.yellow('📚 Relevant Knowledge Used:'));
        result.relevantKnowledge.forEach((k, i) => {
          console.log(chalk.gray(`   ${i + 1}. ${k.question.substring(0, 60)}... (score: ${k.score.toFixed(2)})`));
        });
        console.log();
      }

      console.log(chalk.green('💬 Suggested Response:'));
      console.log(chalk.white('─'.repeat(60)));
      console.log(result.suggestedResponse);
      console.log(chalk.white('─'.repeat(60)));
      console.log();
    } catch (error) {
      console.log(chalk.red(`\n❌ Error: ${error.message}\n`));
    }
  });

// ============ SEARCH COMMAND ============
program
  .command('search <query>')
  .description('Search the knowledge base for relevant Q&A pairs')
  .option('-k, --top-k <number>', 'Number of results to return', '7')
  .action((query, options) => {
    const knowledgeBase = loadKnowledgeBase();
    const results = search(query, knowledgeBase, parseInt(options.topK));

    console.log(chalk.cyan(`\n🔍 Search Results for: "${query}"\n`));

    if (results.length === 0) {
      console.log(chalk.yellow('   No relevant entries found.\n'));
      return;
    }

    results.forEach((entry, i) => {
      console.log(chalk.white(`${i + 1}. ${chalk.yellow('Q:')} ${entry.question}`));
      console.log(chalk.gray(`   ${chalk.green('A:')} ${entry.answer}`));
      console.log(chalk.gray(`   Score: ${entry.score.toFixed(3)}`));
      console.log();
    });
  });

// ============ IGNORED COMMAND ============
program
  .command('ignored')
  .description('Manage ignored users list')
  .option('-r, --remove <username>', 'Remove a user from the ignored list')
  .action(async (options) => {
    if (options.remove) {
      const removed = removeIgnoredUser(options.remove);
      if (removed) {
        console.log(chalk.green(`\n✅ Removed "${options.remove}" from ignored list\n`));
      } else {
        console.log(chalk.yellow(`\n⚠️  "${options.remove}" was not in the ignored list\n`));
      }
      return;
    }

    const ignored = loadIgnoredUsers();
    console.log(chalk.cyan('\n🚫 Ignored Users:\n'));

    if (ignored.users.length === 0) {
      console.log(chalk.gray('   No ignored users\n'));
      return;
    }

    ignored.users.forEach((user, i) => {
      console.log(chalk.white(`   ${i + 1}. ${user.username}`));
      console.log(chalk.gray(`      Reason: ${user.reason}`));
      console.log(chalk.gray(`      Added: ${user.addedAt}`));
    });
    console.log();
  });

// ============ DELETE COMMAND ============
program
  .command('delete <id>')
  .description('Delete an entry from the knowledge base by ID')
  .action(async (id) => {
    const entry = deleteKnowledgeEntry(id);
    
    if (entry) {
      console.log(chalk.green(`\n✅ Deleted entry: ${entry.question.substring(0, 50)}...\n`));
    } else {
      console.log(chalk.red(`\n❌ Entry not found: ${id}\n`));
    }
  });

// ============ INIT COMMAND ============
program
  .command('init')
  .description('Initialize the assistant with config file')
  .action(() => {
    const configPath = join(__dirname, 'config.json');
    const examplePath = join(__dirname, 'config.example.json');
    
    if (existsSync(configPath)) {
      console.log(chalk.yellow('\n⚠️  config.json already exists\n'));
      return;
    }

    copyFileSync(examplePath, configPath);
    console.log(chalk.green('\n✅ Created config.json'));
    console.log(chalk.white('   Please edit it to add your API keys and project details.\n'));
    console.log(chalk.gray(`   Path: ${configPath}\n`));
  });

// Helper function to display process results
function displayProcessResult(result, dryRun) {
  const prefix = dryRun ? chalk.yellow('[DRY RUN] ') : '';
  
  console.log(chalk.white(`${prefix}Username: ${result.username}`));
  console.log(chalk.white(`${prefix}Total Messages: ${result.totalMessages}`));
  console.log(chalk.white(`${prefix}New Messages: ${result.newMessages}`));
  
  if (result.wasIgnored) {
    console.log(chalk.yellow(`${prefix}Status: User is ignored`));
  } else if (result.isInScope === true) {
    console.log(chalk.green(`${prefix}Status: In scope`));
  } else if (result.isInScope === false) {
    console.log(chalk.yellow(`${prefix}Status: Out of scope`));
  } else {
    console.log(chalk.cyan(`${prefix}Status: Needs scope determination`));
  }
  
  if (result.extractedQA.length > 0) {
    console.log(chalk.white(`${prefix}Extracted Q&A pairs: ${result.extractedQA.length}`));
    result.extractedQA.forEach((qa, i) => {
      console.log(chalk.gray(`   ${i + 1}. Q: ${qa.question.substring(0, 50)}...`));
    });
  }
  
  if (result.addedQA.length > 0) {
    console.log(chalk.green(`${prefix}Added to knowledge base: ${result.addedQA.length}`));
  }
  
  if (result.skippedQA.length > 0) {
    console.log(chalk.yellow(`${prefix}Skipped (duplicates): ${result.skippedQA.length}`));
  }
  
  console.log();
}

program.parse();
