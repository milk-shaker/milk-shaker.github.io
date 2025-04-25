const url = 'assets/pitch-deck.pdf';

let pdfDoc = null,
    pageNum = 1,
    pageRendering = false,
    pageNumPending = null;

const scale = 1.5,
      canvas = document.getElementById('pdf-render'),
      ctx = canvas.getContext('2d');

// Render the page
const renderPage = num => {
  pageRendering = true;
  pdfDoc.getPage(num).then(page => {
    const viewport = page.getViewport({ scale });
    canvas.height = viewport.height;
    canvas.width = viewport.width;

    const renderContext = { canvasContext: ctx, viewport };
    const renderTask = page.render(renderContext);

    renderTask.promise.then(() => {
      pageRendering = false;
      if (pageNumPending !== null) {
        renderPage(pageNumPending);
        pageNumPending = null;
      }
    });
    document.getElementById('page-num').textContent = `Page ${num}`;
  });
};

// Queue rendering if another rendering is ongoing
const queueRenderPage = num => {
  if (pageRendering) {
    pageNumPending = num;
  } else {
    renderPage(num);
  }
};

// Next page
const nextPage = () => {
  if (pageNum >= pdfDoc.numPages) return;
  pageNum++;
  queueRenderPage(pageNum);
};

// Prev page
const prevPage = () => {
  if (pageNum <= 1) return;
  pageNum--;
  queueRenderPage(pageNum);
};

document.getElementById('next-page').addEventListener('click', nextPage);
document.getElementById('prev-page').addEventListener('click', prevPage);

// Load PDF
pdfjsLib.getDocument(url).promise.then(pdfDoc_ => {
  pdfDoc = pdfDoc_;
  renderPage(pageNum);
});
