const form = document.querySelector("#search-form");
const usernameInput = document.querySelector("#username");
const statusEl = document.querySelector("#status");
const listEl = document.querySelector("#contribution-list");

function formatDate(dateText) {
  const date = new Date(dateText);

  if (Number.isNaN(date.getTime())) {
    return dateText;
  }

  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function escapeHtml(text) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderContributions(contributions) {
  if (!listEl) return;

  if (!contributions.length) {
    listEl.innerHTML = "";
    return;
  }

  listEl.innerHTML = contributions
    .map(
      (item) => `
        <article class="card">
          <h3>${escapeHtml(item.project)}</h3>
          <p class="meta">${escapeHtml(item.type)} · ${escapeHtml(formatDate(item.date))}</p>
          <p>${escapeHtml(item.summary)}</p>
          <a href="${escapeHtml(item.url)}" target="_blank" rel="noreferrer noopener">Open on GitHub</a>
        </article>
      `,
    )
    .join("");
}

async function loadContributions(username) {
  if (!statusEl || !listEl) return;

  statusEl.textContent = `Loading contributions for ${username}...`;
  listEl.innerHTML = "";

  try {
    const response = await fetch(`/api/contributions?username=${encodeURIComponent(username)}&limit=12`);
    const payload = await response.json();

    if (!response.ok) {
      statusEl.textContent = payload.error || "Failed to load contributions.";
      return;
    }

    const contributions = Array.isArray(payload.contributions) ? payload.contributions : [];
    renderContributions(contributions);

    if (!contributions.length) {
      statusEl.textContent = `No recent supported contribution events found for ${username}.`;
      return;
    }

    statusEl.textContent = `Showing ${contributions.length} recent contribution(s) for ${username}.`;
  } catch (error) {
    statusEl.textContent = "Unable to reach the server.";
  }
}

if (form && usernameInput) {
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const username = usernameInput.value.trim();

    if (!username) {
      if (statusEl) statusEl.textContent = "Please enter a GitHub username.";
      return;
    }

    loadContributions(username);
  });

  usernameInput.value = "octocat";
  loadContributions("octocat");
}
