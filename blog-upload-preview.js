/*
 * Author: Christoph Stoettner
 * Mail: christoph.stoettner@stoeps.de
 * Date: 2025-03-12
 * Modified: 2025-04-22 - Added support for pagination
 * Copyright: Christoph Stoettner
 * License: Apache 2.0
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

  // Create loading indicator (hidden by default)
  const loadingIndicator = document.createElement('span');
  loadingIndicator.textContent = ' Loading...';
  loadingIndicator.style.display = 'none';
  loadingIndicator.id = 'loading-indicator';

  // Append the button to the cell
  newCell.appendChild(toggleButton);
  newCell.appendChild(loadingIndicator);

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

    // Show loading indicator
    document.getElementById('loading-indicator').style.display = 'inline';

    // Fetch RSS feed only if not already fetched
    if (!window.imageUsageData) {
      fetchRssFeedAndCountUsage(blogName, imageLinks, table).then(usageData => {
        window.imageUsageData = usageData;
        // Add preview cells and usage counts to the table
        addPreviewCells(table, imageLinks);
        updateUsageCounts(table, usageData);
        // Hide loading indicator
        document.getElementById('loading-indicator').style.display = 'none';

        // Adjust table width and column widths
        adjustTableLayout();
        // Sort the table after adding the cells
        sortTableByColumn();
      });
    } else {
      // Add preview cells and usage counts to the table
      addPreviewCells(table, imageLinks);
      updateUsageCounts(table, window.imageUsageData);
      // Hide loading indicator
      document.getElementById('loading-indicator').style.display = 'none';

      // Adjust table width and column widths
      adjustTableLayout();
      // Sort the table after adding the cells
      sortTableByColumn();
    }
  } else {
    // Turn previews off
    toggleButton.value = 'Show Image Previews';
    toggleButton.setAttribute('data-state', 'off');

    // Remove all preview cells and usage cells
    removePreviewCells(table);
    removeUsageCells(table);

    // Restore original table width
    table.style.width = '50%';
  }
});

// Function to adjust table layout
function adjustTableLayout() {
  const table = document.querySelector('table.lotusTable');
  table.style.width = '100%';

  // Get the table headers
  const headers = table.querySelectorAll('th');

  // Set the width of the filename column (second column)
  if (headers.length > 1) {
    headers[1].style.width = '60%';
  }

  // Set the width of the preview column (fourth column)
  if (headers.length > 3) {
    headers[3].style.width = '15%';
  }

  // Set the width of the usage count column (fifth column)
  if (headers.length > 4) {
    headers[4].style.width = '15%';
  }
}

// Define the sorting function outside of the click handler
function sortTableByColumn() {
  console.log("start sorting ...");
  // Make sure we're using the correct table
  const tableElement = document.querySelector('table.lotusTable');
  const tbody = tableElement.querySelector('tbody');
  const columnIndex = 4;
  const asc = false;

  // Define the comparer function
  var comparer = function(idx, asc) {
    return function(rowA, rowB) {
      // Function to get cell value from a row at a specific index
      function getCellValue(row, index) {
        return row.cells[index].innerText || row.cells[index].textContent;
      }

      const v1 = getCellValue(asc ? rowA : rowB, idx);
      const v2 = getCellValue(asc ? rowB : rowA, idx);

      // Sort based on numeric or string comparison
      return (v1 !== '' && v2 !== '' && !isNaN(v1) && !isNaN(v2))
        ? v1 - v2
        : v1.toString().localeCompare(v2);
    };
  };

  // Sort and reappend the rows
  Array.from(tbody.querySelectorAll('tr'))
    .sort(comparer(columnIndex, asc))
    .forEach(tr => tbody.appendChild(tr));

  console.log("finished sorting");
}
}

// Function to extract blog name from URL using multiple methods
function extractBlogNameFromUrl() {
  // Try several methods to extract the blog name

  // Method 1: Check for "weblog" parameter in URL
  const urlParams = new URLSearchParams(window.location.search);
  const weblogParam = urlParams.get('weblog');
  if (weblogParam) {
    return weblogParam;
  }

  // Method 2: Extract from path parameter
  const pathParam = urlParams.get('path');
  if (pathParam) {
    // The path will often have a format like /blogs/[blogUUID]/media/...
    // Try to extract the UUID from the path
    const pathParts = pathParam.split('/');
    if (pathParts.length >= 3 && pathParts[1] === 'blogs') {
      return pathParts[2]; // This should be the blog UUID
    }
  }

  // Method 3: Look for blog ID in the current URL path
  const currentPath = window.location.pathname;
  const blogMatch = currentPath.match(/\/blogs\/([a-f0-9-]+)\//i);
  if (blogMatch && blogMatch[1]) {
    return blogMatch[1];
  }

  // If no blog name can be found, return null
  console.warn("Could not detect blog name from URL or page content");
  return null;
}

// Function to fetch RSS feed with pagination and count image usage
async function fetchRssFeedAndCountUsage(blogName, imageLinks, table) {
  try {
    // If no blog name was found, return empty usage data
    if (!blogName) {
      console.error("Could not detect blog name");
      return {};
    }

    // Create a map to store image usage counts
    const usageCounts = {};

    // Initialize variables for pagination
    const pageSize = 50; // Default page size in HCL Connections
    let currentPage = 0;
    let hasMorePages = true;
    let totalEntries = 0;

    // Process all pages
    while (hasMorePages) {
      // Use relative URL with the blog UUID directly
      const feedUrl = "/blogs/roller-ui/rendering/feed/" + blogName + "/entries/atom?lang=en_us&page=" + currentPage + "&ps=" + pageSize;
      console.log("Fetching RSS feed page " + currentPage + " from:", feedUrl);

      const response = await fetch(feedUrl);

      if (!response.ok) {
        throw new Error("Failed to fetch RSS feed: " + response.status);
      }

      const feedText = await response.text();

      // Parse the XML content
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(feedText, "text/xml");

      // Get all entries/posts on this page
      const entries = xmlDoc.querySelectorAll('entry');
      console.log("Found " + entries.length + " blog entries on page " + currentPage);

      // No entries means we've reached the end
      if (entries.length === 0) {
        hasMorePages = false;
        break;
      }

      totalEntries += entries.length;

      // Process each entry to find image references
      entries.forEach(entry => {
        const contentElement = entry.querySelector('content');
        if (!contentElement) return;

        const content = contentElement.textContent || '';

        // Debug first entry content to verify what we're searching
        if (currentPage === 0 && entries[0] === entry) {
          console.log("First entry content sample:", content.substring(0, 500));
        }

        // Check each image link against the content
        imageLinks.forEach(link => {
          // Extract the filename from the link
          const filename = link.textContent;

          // Log for debugging
          if (currentPage === 0 && entries[0] === entry) {
            console.log("Checking for image:", filename);
          }

          // Count occurrences in the content
          // Note: We need to check for the filename or the URL pattern
          /*
	   * const filenameRegex = new RegExp(filename.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
           * const matches1 = content.match(filenameRegex);
           * const count1 = matches1 ? matches1.length : 0;
	   */

          // Also check for URL patterns that might contain the image
	  const urlPattern = new RegExp("(src)=[\"'][^\"']*" + encodeURIComponent(filename).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + "[\"']", 'g');
          // const urlPattern = new RegExp("(src)=[\"'][^\"']*" + filename.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + "[\"']", 'g');
          const matches2 = content.match(urlPattern);
          const count2 = matches2 ? matches2.length : 0;

          const totalCount = count2;

          // Log for debugging
          if (totalCount > 0 && currentPage === 0) {
            console.log("Found image '" + filename + "' " + totalCount + " times in an entry");
          }

          // Update the usage count
          usageCounts[filename] = (usageCounts[filename] || 0) + totalCount;
        });
      });

      // Check if we need to fetch more pages (if entries.length < pageSize, we've reached the end)
      if (entries.length < pageSize) {
        hasMorePages = false;
      } else {
        currentPage++;
      }
    }

    console.log("Processed a total of " + totalEntries + " blog entries across " + currentPage + " pages");
    return usageCounts;

  } catch (error) {
    console.error('Error fetching RSS feed:', error);
    document.getElementById('loading-indicator').style.display = 'none';
    return {};
  }
}

// Function to update usage counts in the table
function updateUsageCounts(table, usageCounts) {
  // Add header for usage column if it doesn't exist
  const headerRow = table.querySelector('tr.lotusFirst.lotusSort');
  if (headerRow && !headerRow.querySelector('.usage-header')) {
    const usageHeader = document.createElement('th');
    usageHeader.textContent = 'Usage Count';
    usageHeader.className = 'lotusAlignCenter usage-header';
    headerRow.appendChild(usageHeader);
  }

  // Log usage counts for debugging
  console.log("Usage counts data:", usageCounts);

  // Get all table rows
  const allRows = Array.from(table.querySelectorAll('tr'));
  console.log("Found " + allRows.length + " total rows in table");

  // Skip just the header row
  const contentRows = allRows.slice(1);
  console.log("Processing " + contentRows.length + " content rows");

  // Process each row
  contentRows.forEach((row, index) => {
    console.log("Processing row " + (index+1));

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
  if (headerRow && !headerRow.querySelector('.preview-header')) {
    const previewHeader = document.createElement('th');
    previewHeader.textContent = 'Preview';
    previewHeader.className = 'lotusAlignCenter preview-header';
    headerRow.appendChild(previewHeader);
  }

  // Get all rows (skip just the header row)
  const contentRows = Array.from(table.querySelectorAll('tr')).slice(1);
  console.log("Adding preview cells to " + contentRows.length + " rows");

  // Process each row
  contentRows.forEach((row, index) => {
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
      thumbnail.alt = "Preview of " + fileLink.textContent;
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

    return pathname.includes('/blogs/roller-ui/authoring/uploadFiles.do');
}

// Initialize the preview toggle when the DOM is fully loaded
if (shouldLoadScript()) {
  document.addEventListener('DOMContentLoaded', () => {
    addImagePreviewToggle();

    // Add CSS for loading indicator
    const style = document.createElement('style');
    style.textContent = "      .usage-count-zero {        color: red;        font-weight: bold;      }      .usage-count-nonzero {        color: green;        font-weight: bold;      }      .image-thumbnail {        max-width: 100px;        max-height: 100px;        cursor: pointer;      }      .image-preview-modal {        position: fixed;        top: 0;        left: 0;        width: 100%;        height: 100%;        background-color: rgba(0, 0, 0, 0.8);        display: flex;        flex-direction: column;        align-items: center;        justify-content: center;        z-index: 1000;      }      .preview-image {        max-width: 90%;        max-height: 80%;        border: 2px solid white;      }      .preview-caption {        color: white;        margin-top: 10px;        font-size: 16px;      }      .preview-close-btn {        position: absolute;        top: 15px;        right: 15px;        color: white;        background: transparent;        border: none;        font-size: 28px;        cursor: pointer;      }      #loading-indicator {        margin-left: 10px;        font-style: italic;      }";
    document.head.appendChild(style);
  });
}
