const scanButton = document.getElementById("scan");
const postsContainer = document.getElementById("posts");
const loader = document.getElementById("loader");

scanButton.addEventListener("click", () => {
  scanButton.disabled = true;
  postsContainer.innerHTML = "";
  loader.style.display = "block";
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
  // Listen for the new message containing posts with scores
  if (request.message === "postsAnalyzed") {
    loader.style.display = "none";
    postsContainer.innerHTML = ""; // Clear previous results
    scanButton.disabled = false;

    if (request.data.length === 0) {
      postsContainer.textContent = "No posts found on the page.";
      return;
    }

    request.data.forEach(post => {
      const postElement = document.createElement("div");
      // Add the post's unique ID to the element for later reference
      postElement.dataset.postId = post.id;
      postElement.className = "post";

      // Sanitize content to prevent HTML injection from post text
      const sanitizedContent = post.content.replace(/</g, "&lt;").replace(/>/g, "&gt;");
      postElement.innerHTML = `<h3>${post.author} <span class="score">AI Score: ${post.score}%</span></h3>
                               <p class="verdict">${post.verdict}</p>
                               <p class="content">${sanitizedContent}</p>
                               <div class="actions">
                                 <button class="ignore-button" data-post-id="${post.id}">Ignore Author</button>
                               </div>`;
      postsContainer.appendChild(postElement);
    });
  } else if (request.message === "ignorePostSuccess") {
    // Update the UI when the automation is complete
    const button = document.querySelector(`.ignore-button[data-post-id="${request.postId}"]`);
    if (button) {
      button.textContent = "Ignored ✓";
    }
  } else if (request.message === "ignorePostFailure") {
    // Update the UI when the automation fails to re-enable the button
    const button = document.querySelector(`.ignore-button[data-post-id="${request.postId}"]`);
    if (button) {
      button.disabled = false;
      button.textContent = "Ignore Author";
      // You could add a small error message next to the button if desired
    }
  }
});