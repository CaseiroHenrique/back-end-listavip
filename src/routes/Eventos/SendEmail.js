const express = require('express');
const router = express.Router();
const nodemailer = require('nodemailer');

router.post('/send-ticket-email', async (req, res) => {
    const { imageData, email } = req.body;

    if (!imageData || !email) {
        return res.status(400).json({ message: 'imageData e email são obrigatórios.' });
    }

    // Validar tamanho do imageData (limitar a 8MB, por exemplo)
    const imageSizeInBytes = Buffer.byteLength(imageData, 'base64');
    const maxSizeInBytes = 8 * 1024 * 1024; // 8 MB

    if (imageSizeInBytes > maxSizeInBytes) {
        return res.status(413).json({ message: 'O ticket é muito grande para ser enviado.' });
    }

    try {
        const transporter = nodemailer.createTransport({
            host: 'smtp.hostinger.com',
            port: 465,
            secure: true,
            auth: {
                user: 'contato@conexaocode.com',
                pass: '#Henrique1312'
            },
            tls: {
                rejectUnauthorized: false
            }
        });

        const mailOptions = {
            from: 'contato@conexaocode.com',
            to: email,
            subject: 'Seu Ticket de Evento',
            html: `<p>Segue o seu ticket para o evento:</p>`,
            attachments: [
                {
                    filename: 'ticket.png',
                    content: imageData.split("base64,")[1],
                    encoding: 'base64'
                }
            ]
        };

        await transporter.sendMail(mailOptions);
        res.status(200).json({ message: 'E-mail enviado com sucesso!' });
    } catch (error) {
        console.error('Erro ao enviar o e-mail:', error);
        res.status(500).json({ message: 'Erro ao enviar o e-mail.' });
    }
});


module.exports = router;
