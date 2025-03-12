/*
 * Author: Christoph Stoettner
 * Mail: christoph.stoettner@stoeps.de
 * Date: 2025-03-12
 * Copyright: © Christoph Stoettner https://stoeps.de
 * License: Apache 2.0 https://www.apache.org/licenses/LICENSE-2.0.html
 */
// Function to add a single preview toggle button and prepare images for preview
function addImagePreviewToggle() {
  // Select the table
  const tableRow = document.querySelector('table[role="presentation"] tbody tr');

  const table = document.querySelector('table.lotusTable');

  // Create a new table cell
  const newCell = document.createElement('td');
  newCell.setAttribute('align', 'left');

  // Create the toggle button
  const toggleButton = document.createElement('input');
  toggleButton.id = "preview";
  toggleButton.type = "button";
  toggleButton.value = "Show Image Preview";
  toggleButton.textContent = 'Show Image Previews';
  toggleButton.className = 'lotusBtn';
  toggleButton.setAttribute('data-state', 'off');

  // Append the button to the cell
  newCell.appendChild(toggleButton);

  // Append the new cell to the row
  tableRow.appendChild(newCell);

  // Get all image links in the table
  const imageLinks = Array.from(table.querySelectorAll('a.bidiSTT_URL')).filter(link =>
    link.href.match(/\.(jpeg|jpg|gif|png)$/i)
  );

  // Extract blog name from the URL
  const blogName = extractBlogNameFromUrl();
  console.log("Detected blog name:", blogName);

  // Store the usage data in a global variable
  window.imageUsageData = null;

  // Add click handler to toggle button
  toggleButton.addEventListener('click', () => {
    const currentState = toggleButton.getAttribute('data-state');
    if (currentState === 'off') {
      // Turn previews on
      toggleButton.value = 'Hide Image Previews';
      toggleButton.setAttribute('data-state', 'on');

      // Fetch RSS feed only if not already fetched
      if (!window.imageUsageData) {
        fetchRssFeedAndCountUsage(blogName, imageLinks, table).then(usageData => {
          window.imageUsageData = usageData;
          // Add preview cells and usage counts to the table
          addPreviewCells(table, imageLinks);
          updateUsageCounts(table, usageData);
        });
      } else {
        // Add preview cells and usage counts to the table
        addPreviewCells(table, imageLinks);
        updateUsageCounts(table, window.imageUsageData);
      }
    } else {
      // Turn previews off
      toggleButton.value = 'Show Image Previews';
      toggleButton.setAttribute('data-state', 'off');

      // Remove all preview cells and usage cells
      removePreviewCells(table);
      removeUsageCells(table);
    }
  });
}

// Function to extract blog name from URL using multiple methods
function extractBlogNameFromUrl() {
  // Try several methods to extract the blog name

  // Method 2: Check for "weblog" parameter in URL
  const urlParams = new URLSearchParams(window.location.search);
  const weblogParam = urlParams.get('weblog');
  if (weblogParam) {
    return weblogParam;
  }

  // If no blog name can be found, return null
  console.warn("Could not detect blog name from URL or page content");
  return null;
}

// Function to fetch RSS feed and count image usage
async function fetchRssFeedAndCountUsage(blogName, imageLinks, table) {
  try {
    // If no blog name was found, return empty usage data
    if (!blogName) {
      console.error("Could not detect blog name");
      return {};
    }

    // Fetch the RSS feed
    const feedUrl = `https://cnx8.stoeps.home/blogs/roller-ui/rendering/feed/${blogName}/entries/atom?lang=en_us`;
    console.log("Fetching RSS feed from:", feedUrl);

    const response = await fetch(feedUrl);

    if (!response.ok) {
      throw new Error(`Failed to fetch RSS feed: ${response.status}`);
    }

    const feedText = await response.text();

    // Parse the XML content
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(feedText, "text/xml");

    // Get all entries/posts
    const entries = xmlDoc.querySelectorAll('entry');
    console.log(`Found ${entries.length} blog entries in the feed`);

    // Create a map to store image usage counts
    const usageCounts = {};

    // Process each entry to find image references
    entries.forEach(entry => {
      const contentElement = entry.querySelector('content');
      if (!contentElement) return;

      const content = contentElement.textContent;

      // Check each image link against the content
      imageLinks.forEach(link => {
        // Extract the filename from the link
        const filename = link.textContent;

        // Count occurrences in the content
        const regex = new RegExp(filename.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
        const matches = content.match(regex);
        const count = matches ? matches.length : 0;

        // Update the usage count
        usageCounts[filename] = (usageCounts[filename] || 0) + count;
      });
    });

    return usageCounts;

  } catch (error) {
    console.error('Error fetching RSS feed:', error);
    return {};
  }
}

// Function to update usage counts in the table
function updateUsageCounts(table, usageCounts) {
  // Add header for usage column if it doesn't exist
  const headerRow = table.querySelector('tr.lotusFirst.lotusSort');
  if (!headerRow.querySelector('.usage-header')) {
    const usageHeader = document.createElement('th');
    usageHeader.textContent = 'Usage Count';
    usageHeader.className = 'lotusAlignCenter usage-header';
    headerRow.appendChild(usageHeader);
  }

  // Get all content rows (skip header and parent directory rows)
  const contentRows = Array.from(table.querySelectorAll('tr')).slice(2);

  // Process each row
  contentRows.forEach(row => {
    // Find image link in this row
    const fileLink = row.querySelector('a.bidiSTT_URL');
    if (!fileLink) {
      // Add empty cell for consistency
      const emptyCell = document.createElement('td');
      emptyCell.className = 'usage-cell';
      row.appendChild(emptyCell);
      return;
    }

    // Create a new cell for usage count
    const usageCell = document.createElement('td');
    usageCell.className = 'lotusAlignRight usage-cell';

    const filename = fileLink.textContent;
    const count = usageCounts[filename] || 0;

    // Create count display with styling based on count
    const countSpan = document.createElement('span');
    countSpan.textContent = count;

    // Apply styling based on count
    if (count === 0) {
      countSpan.className = 'usage-count-zero';
    } else {
      countSpan.className = 'usage-count-nonzero';
    }

    usageCell.appendChild(countSpan);
    row.appendChild(usageCell);
  });
}

// Function to remove usage cells from the table
function removeUsageCells(table) {
  // Remove usage header
  const usageHeader = table.querySelector('.usage-header');
  if (usageHeader) {
    usageHeader.remove();
  }

  // Remove all usage cells
  const usageCells = table.querySelectorAll('.usage-cell');
  usageCells.forEach(cell => {
    cell.remove();
  });
}

// Function to add preview cells to the table
function addPreviewCells(table, imageLinks) {
  // Add header for preview column if it doesn't exist
  const headerRow = table.querySelector('tr.lotusFirst.lotusSort');
  if (!headerRow.querySelector('.preview-header')) {
    const previewHeader = document.createElement('th');
    previewHeader.textContent = 'Preview';
    previewHeader.className = 'lotusAlignCenter preview-header';
    headerRow.appendChild(previewHeader);
  }

  // Get all content rows (skip header and parent directory rows)
  const contentRows = Array.from(table.querySelectorAll('tr')).slice(2);

  // Process each row
  contentRows.forEach(row => {
    // Skip if preview cell already exists
    if (row.querySelector('.preview-cell')) return;

    // Find image link in this row
    const fileLink = row.querySelector('a.bidiSTT_URL');
    if (!fileLink) {
      // Add empty cell for consistency
      const emptyCell = document.createElement('td');
      emptyCell.className = 'preview-cell';
      row.appendChild(emptyCell);
      return;
    }

    // Create a new cell for preview
    const previewCell = document.createElement('td');
    previewCell.className = 'lotusAlignCenter preview-cell';

    // Only create previews for image files
    if (fileLink.href.match(/\.(jpeg|jpg|gif|png)$/i)) {
      // Create a thumbnail container
      const thumbnailContainer = document.createElement('div');
      thumbnailContainer.className = 'thumbnail-container';

      // Create the thumbnail image
      const thumbnail = document.createElement('img');
      thumbnail.src = fileLink.href;
      thumbnail.alt = `Preview of ${fileLink.textContent}`;
      thumbnail.className = 'image-thumbnail';
      thumbnail.loading = 'lazy'; // Lazy load images

      // Add click handler to show larger preview
      thumbnail.addEventListener('click', () => {
        showLargerPreview(fileLink.href, fileLink.textContent);
      });

      // Add the thumbnail to the container
      thumbnailContainer.appendChild(thumbnail);

      // Add the container to the cell
      previewCell.appendChild(thumbnailContainer);
    } else {
      // Not an image file
      previewCell.textContent = '-';
    }

    // Append the new cell to the row
    row.appendChild(previewCell);
  });
}

// Function to remove preview cells from the table
function removePreviewCells(table) {
  // Remove preview header
  const previewHeader = table.querySelector('.preview-header');
  if (previewHeader) {
    previewHeader.remove();
  }

  // Remove all preview cells
  const previewCells = table.querySelectorAll('.preview-cell');
  previewCells.forEach(cell => {
    cell.remove();
  });
}

// Function to show a larger preview when thumbnail is clicked
function showLargerPreview(imageUrl, fileName) {
  // Create modal container
  const modal = document.createElement('div');
  modal.className = 'image-preview-modal';

  // Create image element
  const image = document.createElement('img');
  image.src = imageUrl;
  image.alt = fileName;
  image.className = 'preview-image';

  // Create close button
  const closeBtn = document.createElement('button');
  closeBtn.className = 'preview-close-btn';
  closeBtn.innerHTML = '&times;';
  closeBtn.addEventListener('click', () => {
    document.body.removeChild(modal);
  });

  // Create caption
  const caption = document.createElement('div');
  caption.className = 'preview-caption';
  caption.textContent = fileName;

  // Add elements to modal
  modal.appendChild(closeBtn);
  modal.appendChild(image);
  modal.appendChild(caption);

  // Add modal to body
  document.body.appendChild(modal);

  // Close modal when clicking outside the image
  modal.addEventListener('click', (event) => {
    if (event.target === modal) {
      document.body.removeChild(modal);
    }
  });
}

function shouldLoadScript() {
    const url = new URL(window.location.href);
    const pathname = url.pathname;
    const pathParam = url.searchParams.get('path');

    return pathname.includes('/blogs/roller-ui/authoring/uploadFiles.do') &&
           pathParam && pathParam.length > 0;
}

// Add CSS for the previews
function addPreviewStyles() {
  const styleElement = document.createElement('style');
  styleElement.textContent = `
    .preview-toggle-container {
      margin-bottom: 10px;
      text-align: right;
    }

    .preview-toggle-button {
      padding: 6px 12px;
      background-color: #4178BE;
      color: white;
      border: none;
      border-radius: 3px;
      cursor: pointer;
      font-size: 13px;
      transition: background-color 0.2s ease;
    }

    .preview-toggle-button:hover {
      background-color: #365FA7;
    }

    .preview-cell {
      vertical-align: middle;
      padding: 8px;
    }

    .thumbnail-container {
      width: 80px;
      height: 60px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto;
      cursor: pointer;
    }

    .image-thumbnail {
      max-width: 80px;
      max-height: 60px;
      border: 1px solid #ddd;
      border-radius: 3px;
      transition: transform 0.2s ease;
    }

    .image-thumbnail:hover {
      transform: scale(1.1);
      box-shadow: 0 0 5px rgba(0,0,0,0.2);
    }

    .image-preview-modal {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-color: rgba(0,0,0,0.8);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      z-index: 1000;
    }

    .preview-image {
      max-width: 90%;
      max-height: 80%;
      border: 2px solid white;
    }

    .preview-close-btn {
      position: absolute;
      top: 15px;
      right: 25px;
      font-size: 30px;
      color: white;
      background: none;
      border: none;
      cursor: pointer;
    }

    .preview-caption {
      color: white;
      font-size: 16px;
      margin-top: 10px;
      max-width: 80%;
      text-align: center;
      word-break: break-all;
    }

    .app-blogs.cnx8-ui #filesListForm input#preview{
      background: var(--color-button) !important;
      color: var(--color-button-text) !important;
      margin-left: 0px;
      text-shadow: none;
    }

    .app-blogs.cnx8-ui #filesListForm input#preview:hover {
      background-color: var(--color-button-hover) !important;
      color: var(--color-button-text) !important;
      text-shadow: none;
      box-shadow: none !important;
    }

    .lotusAlignRight {
      text-align: right !important;
      padding-left: 10px !important;
      }

    .lotusAlignCenter {
      text-align: center !important;
      padding-left: 10px !important;
      }

    .lotusui30 :has(#lotusContent) table.lotusTable tbody tr.lotusAltRow td.lotusAlignRight.usage-cell span.usage-count-zero {
      color: red !important;
      font-weight: bold;
    }

    .lotusui30 :has(#lotusContent) table.lotusTable tbody tr.lotusAltRow td.lotusAlignRight.usage-cell span.usage-count-nonzero {
      color: green !important;
    }
  `;

  document.head.appendChild(styleElement);
}

// Initialize the preview toggle when
// Initialize the preview toggle when the DOM is fully loaded
if (shouldLoadScript()) {
  document.addEventListener('DOMContentLoaded', () => {
    addPreviewStyles();
    addImagePreviewToggle();
  });
}
