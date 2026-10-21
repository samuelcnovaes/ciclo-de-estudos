// Keep scheduling separate from rendering; elapsed time is calculated from timestamps in the page.
setInterval(() => postMessage('tick'), 1000);
