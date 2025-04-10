document.getElementById('upload-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  const file = document.getElementById('file-input').files[0];
  if (!file) return;

  const formData = new FormData();
  formData.append('file', file);

  const resultsDiv = document.getElementById('results');
  resultsDiv.innerHTML = '⏳ Validating...';

  const res = await fetch('/test/validate', {
    method: 'POST',
    body: formData,
  });

  const data = await res.json();
  resultsDiv.innerHTML = `<h3>Results (${data.total}):</h3>`;
  data.results.forEach((item) => {
    const div = document.createElement('div');
    div.className = 'result-item';
    div.innerHTML = `<span>${item.email}</span>: ${item.status.join(', ')}`;
    resultsDiv.appendChild(div);
  });
});
