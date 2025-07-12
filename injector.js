console.log("LinkedLens Injector loaded.");

/**
 * Determines the color for the AI score badge based on the score.
 * @param {number} score - The AI score (0-100).
 * @returns {string} A CSS color string.
 */
function getScoreColor(score) {
  if (score >= 70) return '#d11124'; // Red for high AI probability
  if (score >= 45) return '#b45d00'; // Orange for medium AI probability
  return '#055808'; // Green for low AI probability
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => { // Make listener async
  // Listen for the message to inject the AI score
  if (request.message === "injectAiScore") {
    const { postId, score } = request;

    // Find the post element on the page using the unique data-urn attribute
    const postElement = document.querySelector(`div[data-urn="${postId}"]`);
    if (!postElement) {
      console.warn(`[LinkedLens] Could not find post with ID ${postId} to inject score.`);
      return;
    }

    // Find the social actions bar where the "Like", "Comment" buttons are
    const socialActionBar = postElement.querySelector('.feed-shared-social-action-bar');
    if (!socialActionBar) {
      console.warn(`[LinkedLens] Could not find social action bar for post ${postId}.`);
      return;
    }

    // Use a container for our component to avoid conflicts
    const containerId = `linkedlens-container-${postId}`;
    const existingContainer = socialActionBar.querySelector(`#${containerId}`);

    // If the container already exists, just update the score inside its shadow DOM
    if (existingContainer) {
      const badge = existingContainer.shadowRoot.querySelector('.linkedlens-ai-badge');
      if (badge) {
        badge.textContent = `🤖 AI Score: ${score}%`;
        badge.style.color = getScoreColor(score);
      }
      return;
    }

    // 1. Create a container element that will host the shadow root
    const container = document.createElement('div');
    container.id = containerId;
    container.style.marginLeft = 'auto'; // Push it to the right

    // 2. Attach the shadow root to the container
    const shadowRoot = container.attachShadow({ mode: 'open' });

    // 3. Create the UI elements to live inside the shadow DOM
    const badge = document.createElement('div');
    badge.style.color = getScoreColor(score); // Apply dynamic color
    badge.className = 'linkedlens-ai-badge';
    badge.textContent = `🤖 AI Score: ${score}%`;

    const styles = document.createElement('style');
    styles.textContent = `
      .linkedlens-ai-badge {
        display: inline-flex;
        align-items: center;
        padding: 4px 8px;
        background-color: #eef3f8;
        border-radius: 4px;
        font-weight: 600;
        font-size: 12px;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      }`;

    // 4. Append the styles and the badge to the shadow root, then append the container to the page.
    shadowRoot.appendChild(styles);
    shadowRoot.appendChild(badge);
    socialActionBar.appendChild(container);
  } else if (request.message === "ignorePost") {
    // Handle the post ignore automation
    runIgnoreSequence(request.postId);
  }
});

/**
 * Helper function to introduce a delay.
 * @param {number} ms - Milliseconds to wait.
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Finds an element that is visible on the page and contains specific text, then clicks it.
 * @param {string} selector - The CSS selector for the elements to search.
 * @param {string} textToMatch - The text the element's innerText should include.
 * @param {Element} parent - The parent element to search within (defaults to document).
 * @returns {Promise<Element>} A promise that resolves when the element is clicked.
 */
async function findAndClick(selector, textToMatch, parent = document) {
  return new Promise((resolve, reject) => {
    const timeout = 5000; // 5-second timeout
    const interval = 100; // Check every 100ms
    let elapsedTime = 0;

    const timer = setInterval(() => {
      const elements = parent.querySelectorAll(selector);
      for (const element of elements) {
        // If textToMatch is empty, we don't need to check the text content.
        // Otherwise, we check if the element's text includes the text to match.
        const textCheckPassed = !textToMatch || (element.innerText && element.innerText.trim().includes(textToMatch));

        if (textCheckPassed) {
          const style = window.getComputedStyle(element);
          if (style.display !== 'none' && style.visibility !== 'hidden' && element.offsetParent !== null) {
            clearInterval(timer);
            element.click();
            resolve(element);
            return;
          }
        }
      }

      elapsedTime += interval;
      if (elapsedTime >= timeout) {
        clearInterval(timer);
        reject(new Error(`Element not found or not visible: ${selector} with text "${textToMatch}"`));
      }
    }, interval);
  });
}

/**
 * Executes the full sequence of clicks to report and ignore a post's author.
 * @param {string} postId - The unique URN of the post to ignore.
 */
async function runIgnoreSequence(postId) {
  try {
    const postElement = document.querySelector(`div[data-urn="${postId}"]`);
    if (!postElement) throw new Error("Could not find the target post element on the page.");

    // 1. Click the three-dot control menu on the post
    await findAndClick('.feed-shared-control-menu__trigger', '', postElement);
    await sleep(500); // Wait for dropdown menu to appear

    // 2. Click "Report post" from the dropdown (searches the whole document)
    await findAndClick('.artdeco-dropdown__item', 'Report');
    await sleep(1000); // Wait for the report modal to open

    // 3. Click "I want to provide feedback to help improve my feed"
    await findAndClick('button', 'I want to provide feedback');
    await sleep(500);

    // 4. Select the reason "I'm not interested in this author"
    await findAndClick('label', "I'm not interested in this author");
    await sleep(500);

    // 5. Click the final "Submit" button
    await findAndClick('button.artdeco-button--primary', 'Submit');

    console.log(`[LinkedLens] Successfully ignored author for post: ${postId}`);
    // Send a success message back to the popup
    chrome.runtime.sendMessage({ message: "ignorePostSuccess", postId: postId })
      .catch(error => {
        // This error is expected if the popup is closed. We can safely ignore it.
        if (!error.message.includes("Receiving end does not exist")) {
          console.error("[LinkedLens] Error sending success message:", error);
        }
      });

  } catch (error) {
    console.error("[LinkedLens] Ignore sequence failed:", error);
    // Send a failure message back to re-enable the button in the popup
    chrome.runtime.sendMessage({ message: "ignorePostFailure", postId: postId })
      .catch(error => {
        // This error is expected if the popup is closed. We can safely ignore it.
        if (!error.message.includes("Receiving end does not exist")) {
          console.error("[LinkedLens] Error sending failure message:", error);
        }
      });
  }
}