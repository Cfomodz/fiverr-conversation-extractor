const signals = [
  {
    id: "gmail",
    name: "Gmail active in last 10 min",
    note: "Inbox activity often means quick replies are possible.",
    weight: 10,
    defaultActive: true
  },
  {
    id: "chat",
    name: "Chat presence green",
    note: "Active chat status suggests you are reachable.",
    weight: 7,
    defaultActive: true
  },
  {
    id: "phoneRecent",
    name: "Phone unlocked in last 10 min",
    note: "Recent unlocks signal quick response windows.",
    weight: 9,
    group: "phone",
    defaultActive: true
  },
  {
    id: "phoneIdle",
    name: "Phone idle for 45+ min",
    note: "No unlocks can signal deep focus or away from phone.",
    weight: -10,
    group: "phone"
  },
  {
    id: "browserActive",
    name: "Browser active in last hour",
    note: "Recent browsing can mean lighter focus.",
    weight: 6,
    group: "browser",
    defaultActive: true
  },
  {
    id: "browserIdle",
    name: "No browser activity for 60+ min",
    note: "Long idle browser sessions point to heads down work.",
    weight: -12,
    group: "browser"
  },
  {
    id: "calendar",
    name: "Calendar event in progress",
    note: "Live meetings should block interruptions.",
    weight: -30
  },
  {
    id: "focus",
    name: "Focus mode or DND enabled",
    note: "Do not disturb is a strong busy signal.",
    weight: -22
  },
  {
    id: "coding",
    name: "Coding streak 2+ hours",
    note: "Long coding sessions reduce call readiness.",
    weight: -18
  }
];

const channelConfig = {
  call: {
    label: "Call",
    minScore: 75,
    blockSignals: ["calendar", "focus"],
    blockMessage: "Focus mode or a meeting detected."
  },
  text: {
    label: "Text",
    minScore: 60,
    blockSignals: ["calendar"],
    blockMessage: "Meeting detected. Try email instead."
  },
  email: {
    label: "Email",
    minScore: 40,
    blockSignals: [],
    blockMessage: ""
  },
  async: {
    label: "Async task",
    minScore: 35,
    blockSignals: [],
    blockMessage: ""
  }
};

const channelCopy = {
  call: {
    good: "Good time",
    maybe: "Maybe",
    hold: "Hold",
    notes: {
      good: "Likely quick pickup.",
      maybe: "Might connect, expect a delay.",
      hold: "Low chance of answering right now."
    }
  },
  text: {
    good: "Good time",
    maybe: "Maybe",
    hold: "Hold",
    notes: {
      good: "Likely quick response.",
      maybe: "Send if needed, expect a delay.",
      hold: "Hold unless urgent."
    }
  },
  email: {
    good: "Ok to send",
    maybe: "Send with delay",
    hold: "Send and wait",
    notes: {
      good: "Safe for async follow up.",
      maybe: "Expect a later reply.",
      hold: "Send only if you can wait."
    }
  },
  async: {
    good: "Green light",
    maybe: "Ok to queue",
    hold: "Queue only",
    notes: {
      good: "Queue it up with no rush.",
      maybe: "Safe to queue, no rush.",
      hold: "Queue only, no urgency."
    }
  }
};

const state = {
  reviewScore: 0,
  reviewTotal: 0,
  reviewPositive: 0,
  sensitivity: 50
};

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function renderSignals() {
  const list = document.getElementById("signalList");
  if (!list) return;

  list.innerHTML = "";

  signals.forEach((signal) => {
    const item = document.createElement("label");
    item.className = "signal-item";

    const text = document.createElement("span");
    text.className = "signal-text";

    const name = document.createElement("span");
    name.className = "signal-name";
    name.textContent = signal.name;

    const note = document.createElement("span");
    note.className = "signal-note";
    note.textContent = signal.note;

    text.appendChild(name);
    text.appendChild(note);

    const input = document.createElement("input");
    input.type = "checkbox";
    input.className = "signal-input";
    input.dataset.signalId = signal.id;
    if (signal.defaultActive) {
      input.checked = true;
    }

    input.addEventListener("change", () => handleSignalToggle(signal));

    item.appendChild(text);
    item.appendChild(input);
    list.appendChild(item);
  });
}

function handleSignalToggle(signal) {
  if (signal.group) {
    const input = document.querySelector(`[data-signal-id="${signal.id}"]`);
    if (input && input.checked) {
      signals.forEach((other) => {
        if (other.group === signal.group && other.id !== signal.id) {
          const otherInput = document.querySelector(`[data-signal-id="${other.id}"]`);
          if (otherInput) {
            otherInput.checked = false;
          }
        }
      });
    }
  }

  updateUI();
}

function getActiveSignals() {
  return signals.filter((signal) => {
    const input = document.querySelector(`[data-signal-id="${signal.id}"]`);
    return input && input.checked;
  });
}

function calculateScore(activeSignals) {
  const baseScore = 50;
  const bias = Math.round((state.sensitivity - 50) / 2);
  const signalScore = activeSignals.reduce((sum, signal) => sum + signal.weight, 0);
  return clamp(baseScore + bias + signalScore, 0, 100);
}

function getStatus(score) {
  if (score >= 70) {
    return {
      label: "Free right now",
      tone: "good",
      message: "Signals suggest you are interruptible and responsive."
    };
  }

  if (score >= 45) {
    return {
      label: "Maybe",
      tone: "maybe",
      message: "Mixed signals. Expect a delay before a reply."
    };
  }

  return {
    label: "Heads down",
    tone: "busy",
    message: "Signals point to focused work. Hold interruptions."
  };
}

function getConfidence(activeCount) {
  const base = 40;
  const confidence = base + activeCount * 6 + state.reviewScore;
  return clamp(confidence, 30, 95);
}

function updateWhyList(activeSignals) {
  const list = document.getElementById("whyList");
  if (!list) return;

  list.innerHTML = "";

  if (activeSignals.length === 0) {
    const item = document.createElement("li");
    item.textContent = "No signals yet. Toggle a few to see the model react.";
    list.appendChild(item);
    return;
  }

  const topSignals = [...activeSignals]
    .sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight))
    .slice(0, 3);

  topSignals.forEach((signal) => {
    const item = document.createElement("li");
    const direction = signal.weight >= 0 ? "+" : "-";
    item.textContent = `${direction} ${signal.name}`;
    list.appendChild(item);
  });
}

function updateChannels(score, activeSet) {
  const results = {};
  const priority = ["call", "text", "email", "async"];

  Object.keys(channelConfig).forEach((key) => {
    const config = channelConfig[key];
    const blocked = config.blockSignals.some((id) => activeSet.has(id));
    let tone = "hold";

    if (!blocked) {
      if (score >= config.minScore) {
        tone = "good";
      } else if (score >= config.minScore - 15) {
        tone = "maybe";
      }
    }

    const statusText = blocked ? "Hold" : channelCopy[key][tone];
    const noteText = blocked && config.blockMessage ? config.blockMessage : channelCopy[key].notes[tone];

    results[key] = {
      tone,
      statusText,
      noteText,
      label: config.label
    };

    updateChannelUI(key, results[key]);
  });

  const bestId = priority.find((id) => results[id].tone === "good")
    || priority.find((id) => results[id].tone === "maybe")
    || "async";

  const bestChannel = document.getElementById("bestChannel");
  if (bestChannel) {
    bestChannel.textContent = results[bestId].label;
  }

  return results;
}

function updateChannelUI(channelId, data) {
  const card = document.getElementById(`channel-${channelId}`);
  const statusEl = document.getElementById(`channel-${channelId}-status`);
  const noteEl = document.getElementById(`channel-${channelId}-note`);

  if (card) {
    card.dataset.tone = data.tone;
  }
  if (statusEl) {
    statusEl.textContent = data.statusText;
  }
  if (noteEl) {
    noteEl.textContent = data.noteText;
  }
}

function formatTime(date) {
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit"
  });
}

function updateSensitivityLabel(value) {
  const label = document.getElementById("sensitivityLabel");
  if (!label) return;

  if (value < 34) {
    label.textContent = "Conservative";
  } else if (value < 67) {
    label.textContent = "Balanced";
  } else {
    label.textContent = "Open";
  }
}

function updateUI() {
  const activeSignals = getActiveSignals();
  const activeSet = new Set(activeSignals.map((signal) => signal.id));
  const score = calculateScore(activeSignals);
  const status = getStatus(score);
  const confidence = getConfidence(activeSignals.length);

  const statusBadge = document.getElementById("statusBadge");
  const statusCard = document.getElementById("statusCard");
  const statusScore = document.getElementById("statusScore");
  const statusMeter = document.getElementById("statusMeter");
  const statusMessage = document.getElementById("statusMessage");
  const confidenceScore = document.getElementById("confidenceScore");
  const confidenceMeter = document.getElementById("confidenceMeter");
  const lastUpdated = document.getElementById("lastUpdated");
  const activeCount = document.getElementById("activeCount");

  if (statusBadge) {
    statusBadge.textContent = status.label;
    statusBadge.classList.remove("good", "maybe", "busy");
    statusBadge.classList.add(status.tone);
  }

  if (statusCard) {
    statusCard.dataset.tone = status.tone;
  }

  if (statusScore) {
    statusScore.textContent = Math.round(score);
  }

  if (statusMeter) {
    statusMeter.style.width = `${score}%`;
  }

  if (statusMessage) {
    statusMessage.textContent = status.message;
  }

  if (confidenceScore) {
    confidenceScore.textContent = `${confidence}%`;
  }

  if (confidenceMeter) {
    confidenceMeter.style.width = `${confidence}%`;
  }

  if (lastUpdated) {
    lastUpdated.textContent = formatTime(new Date());
  }

  if (activeCount) {
    activeCount.textContent = activeSignals.length;
  }

  updateWhyList(activeSignals);
  updateChannels(score, activeSet);
}

function updateReviewFeedback(isPositive) {
  const feedback = document.getElementById("reviewFeedback");
  if (!feedback) return;

  if (state.reviewTotal === 0) {
    feedback.textContent = "";
    return;
  }

  const accuracy = Math.round((state.reviewPositive / state.reviewTotal) * 100);
  const actionText = isPositive
    ? "Thanks, that reinforces the rule."
    : "Got it, the model will adjust.";
  feedback.textContent = `${actionText} ${accuracy}% of check-ins have been confirmed.`;
}

function scrollToId(id) {
  const element = document.getElementById(id);
  if (element) {
    element.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

document.addEventListener("DOMContentLoaded", () => {
  renderSignals();

  const sensitivityInput = document.getElementById("sensitivity");
  if (sensitivityInput) {
    sensitivityInput.addEventListener("input", (event) => {
      state.sensitivity = parseInt(event.target.value, 10);
      updateSensitivityLabel(state.sensitivity);
      updateUI();
    });
  }

  const reviewYes = document.getElementById("reviewYes");
  if (reviewYes) {
    reviewYes.addEventListener("click", () => {
      state.reviewTotal += 1;
      state.reviewPositive += 1;
      state.reviewScore = clamp(state.reviewScore + 3, -12, 18);
      updateReviewFeedback(true);
      updateUI();
    });
  }

  const reviewNo = document.getElementById("reviewNo");
  if (reviewNo) {
    reviewNo.addEventListener("click", () => {
      state.reviewTotal += 1;
      state.reviewScore = clamp(state.reviewScore - 3, -12, 18);
      updateReviewFeedback(false);
      updateUI();
    });
  }

  const waitlistForm = document.getElementById("waitlistForm");
  if (waitlistForm) {
    waitlistForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const input = document.getElementById("email");
      const note = document.getElementById("formNote");
      if (input && input.value.trim()) {
        if (note) {
          note.textContent = "Thanks, we will reach out soon.";
        }
        waitlistForm.reset();
      }
    });
  }

  const heroDemo = document.getElementById("heroDemo");
  if (heroDemo) {
    heroDemo.addEventListener("click", () => scrollToId("demo"));
  }

  const heroWaitlist = document.getElementById("heroWaitlist");
  if (heroWaitlist) {
    heroWaitlist.addEventListener("click", () => scrollToId("waitlist"));
  }

  const headerWaitlist = document.getElementById("headerWaitlist");
  if (headerWaitlist) {
    headerWaitlist.addEventListener("click", () => scrollToId("waitlist"));
  }

  updateSensitivityLabel(state.sensitivity);
  updateUI();
});
