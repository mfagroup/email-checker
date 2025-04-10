const express = require('express');
const multer = require('multer');
const csv = require('csv-parser');
const dns = require('dns').promises;
const SMTPConnection = require('smtp-connection');
const fs = require('fs');
const cors = require('cors');

const app = express();
const upload = multer({ dest: 'uploads/' });
const PORT = process.env.PORT || 3000;

// ✅ Enable CORS for your frontend
app.use(cors({
  origin: 'https://staff.mfabowl.com'
}));

// ✅ Serve static files if needed (optional)
app.use('/test', express.static('public'));

// ✅ Email syntax check (improved + cleans BOM chars)
function isValidEmailSyntax(email) {
  const clean = email.trim().toLowerCase().replace(/\uFEFF/g, '');
  const regex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return regex.test(clean);
}

// ✅ Check for MX records
async function checkDomain(domain) {
  try {
    const mx = await dns.resolveMx(domain);
    return mx.length > 0;
  } catch {
    return false;
  }
}

// ✅ SMTP handshake (RCPT TO only, no email sent)
async function verifySMTP(email, domain) {
  try {
    const mx = await dns.resolveMx(domain);
    const host = mx.sort((a, b) => a.priority - b.priority)[0].exchange;

    return new Promise((resolve) => {
      const conn = new SMTPConnection({
        port: 25,
        host,
        tls: { rejectUnauthorized: false },
        socketTimeout: 5000,
      });

      conn.on('error', () => resolve('invalid_smtp'));

      conn.connect(() => {
        conn.login({}, () => {
          conn.send({ from: 'noreply@test.com', to: [email] }, '', (err) => {
            if (err && err.code === 'EMESSAGE') resolve('rejected_email');
            else if (err) resolve('invalid_smtp');
            else resolve('valid');
            conn.quit();
          });
        });
      });
    });
  } catch {
    return 'invalid_smtp';
  }
}

// ✅ Main validation endpoint
app.post('/test/validate', upload.single('file'), async (req, res) => {
  console.log("📥 File received from frontend");

  const seen = new Set();
  const results = [];
  const emails = [];

  fs.createReadStream(req.file.path)
    .pipe(csv())
    .on('data', (row) => {
      const email = Object.values(row)[0]?.trim().toLowerCase().replace(/\uFEFF/g, '');
      if (email) emails.push(email);
    })
    .on('end', async () => {
      for (const email of emails) {
        const status = [];
        if (seen.has(email)) {
          results.push({ email, status: ['duplicate'] });
          continue;
        }
        seen.add(email);

        if (!isValidEmailSyntax(email)) {
          results.push({ email, status: ['invalid_email'] });
          continue;
        }

        const domain = email.split('@')[1];
        const domainOk = await checkDomain(domain);
        if (!domainOk) {
          results.push({ email, status: ['invalid_domain'] });
          continue;
        }

        const smtp = await verifySMTP(email, domain);
        if (smtp !== 'valid') status.push(smtp);

        results.push({ email, status: status.length ? status : ['valid'] });
      }

      fs.unlinkSync(req.file.path);
      res.json({ total: results.length, results });
    });
});

app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});
