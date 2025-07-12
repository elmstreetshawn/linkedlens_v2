const scanButton = document.getElementById("scan");
const postsContainer = document.getElementById("posts");
const loader = document.getElementById("loader");
let currentTabId = null;

/**
 * Renders a list of post objects into the popup's UI.
 * @param {Array<Object>} posts - The array of post data to render.
 */
function renderPosts(posts) {
  loader.style.display = "none";
  postsContainer.innerHTML = "";
  scanButton.disabled = false;

  if (!posts || posts.length === 0) {
    postsContainer.textContent = "No posts found on the page. Click 'Scan Posts' to begin.";
    return;
  }

  posts.forEach(post => {
    const postElement = document.createElement("div");
    postElement.dataset.postId = post.id;
    postElement.className = "post";
    const sanitizedContent = post.content.replace(/</g, "&lt;").replace(/>/g, "&gt;");
    postElement.innerHTML = `<h3>${post.author} <span class="score">AI Score: ${post.score}%</span></h3>
                             <p class="verdict">${post.verdict}</p>
                             <p class="content">${sanitizedContent}</p>
                             <div class="actions">
                               <button class="ignore-button" data-post-id="${post.id}">Ignore Author</button>
                             </div>`;
    postsContainer.appendChild(postElement);
  });
}

// On popup open, get the current tab and try to load its saved results.
document.addEventListener('DOMContentLoaded', () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]?.id) {
      currentTabId = tabs[0].id;
      const storageKey = `lastScanResults_${currentTabId}`;
      chrome.storage.session.get([storageKey], (result) => {
        if (result[storageKey]) {
          renderPosts(result[storageKey]);
        } else {
          postsContainer.textContent = "Click 'Scan Posts' to analyze the page.";
        }
      });
    }
  });
});

scanButton.addEventListener("click", () => {
  scanButton.disabled = true;
  postsContainer.innerHTML = "";
  loader.style.display = "block";
  // Clear storage for the current tab before starting a new scan
  if (currentTabId) {
    chrome.storage.session.remove(`lastScanResults_${currentTabId}`);
  }
  chrome.runtime.sendMessage({ message: "getPosts" });
});

// Use event delegation to handle clicks on dynamically added "ignore" buttons
postsContainer.addEventListener("click", (event) => {
  if (event.target.classList.contains("ignore-button")) {
    const button = event.target;
    const postId = button.dataset.postId;
    if (postId) {
      // Disable the button to prevent multiple clicks
      button.disabled = true;
      button.textContent = "Ignoring...";
      chrome.runtime.sendMessage({ message: "ignorePost", postId: postId });
    }
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.message) {
    case "postsAnalyzed":
      // Render the results only if they are for the currently active tab.
      if (request.tabId === currentTabId) {
        renderPosts(request.data);
      }
      break;
    case "ignorePostSuccess":
      const successButton = document.querySelector(`.ignore-button[data-post-id="${request.postId}"]`);
      if (successButton) successButton.textContent = "Ignored ✓";
      break;
    case "ignorePostFailure":
      const failureButton = document.querySelector(`.ignore-button[data-post-id="${request.postId}"]`);
      if (failureButton) {
        failureButton.disabled = false;
        failureButton.textContent = "Ignore Author";
      }
      break;
  }
});