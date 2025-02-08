const express = require('express');
const axios = require('axios');
const router = express.Router();
const db = require('../config/database');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');

router.post('/generate-qrcode', async (req, res) => {
  const { title, price, userData } = req.body;

  if (!title || !price || !userData) {
    return res.status(400).json({ error: "Dados insuficientes para processar o pagamento." });
  }

  try {
    const connection = await db.connect();
    const [config] = await connection.query('SELECT * FROM config LIMIT 1');

    if (!config || config.length === 0) {
      connection.end();
      return res.status(500).json({ error: "Configurações de pagamento não encontradas." });
    }

    const accessToken = config[0].mercado_pago_access_token;

    const paymentData = {
      transaction_amount: parseFloat(price), 
      description: title,
      payment_method_id: "pix",
      payer: {
        email: userData.email,
        identification: {
          type: "CPF",
          number: userData.cpf,
        },
      },
    };

    const response = await axios.post(
      'https://api.mercadopago.com/v1/payments',
      paymentData,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const payment = response.data;

    if (payment.point_of_interaction) {
      const qrCodeBase64 = payment.point_of_interaction.transaction_data.qr_code_base64;
      const qrCode = payment.point_of_interaction.transaction_data.qr_code;

      await connection.query(
        'INSERT INTO payment_temp (payment_id, title, user_data) VALUES (?, ?, ?)',
        [payment.id, title, JSON.stringify(userData)]
      );

      connection.end();

      return res.status(200).json({
        qrCode: `data:image/png;base64,${qrCodeBase64}`,
        pixCopyPaste: qrCode,
        paymentId: payment.id,
        status: payment.status,
      });
    }

    connection.end();
    res.status(500).json({ error: "Falha ao gerar QR Code." });
  } catch (error) {
    console.error("Erro ao criar pagamento Mercado Pago", error.response?.data || error);
    res.status(500).json({ error: "Erro interno ao processar pagamento." });
  }
});

router.get('/payment-status/:paymentId', async (req, res) => {
  const { paymentId } = req.params;

  try {
    const connection = await db.connect();
    const [config] = await connection.query('SELECT * FROM config LIMIT 1');

    if (!config || config.length === 0) {
      connection.end();
      return res.status(500).json({ error: "Configurações de pagamento não encontradas." });
    }

    const accessToken = config[0].mercado_pago_access_token;

    const response = await axios.get(
      `https://api.mercadopago.com/v1/payments/${paymentId}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    const payment = response.data;

    if (payment.status === "approved") {
      const [tempData] = await connection.query(
        'SELECT * FROM payment_temp WHERE payment_id = ?',
        [paymentId]
      );

      if (tempData.length === 0) {
        connection.end();
        return res.status(404).json({ error: "Informações temporárias não encontradas." });
      }

      const { title, user_data } = tempData[0];
      const userData = JSON.parse(user_data);

      if (!userData.full_name || userData.full_name.trim() === "") {
        connection.end();
        return res.status(400).json({ error: "O campo full_name é obrigatório." });
      }

      const [user] = await connection.query(
        'SELECT * FROM users WHERE email = ?',
        [userData.email]
      );

      if (user.length > 0) {
        const userInfo = user[0];
        const companyId = userInfo.company_id;

        if (companyId) {
          const [company] = await connection.query(
            'SELECT * FROM companies WHERE id = ?',
            [companyId]
          );

          if (company.length > 0) {
            const currentEndDate = new Date(company[0].subscription_end || new Date());
            const newStartDate = currentEndDate > new Date() ? currentEndDate : new Date();
            const newEndDate = new Date(newStartDate);
            newEndDate.setMonth(newStartDate.getMonth() + 1); // Adicionar 1 mês

            await connection.query(
              'UPDATE companies SET subscription_type = ?, subscription_start = ?, subscription_end = ? WHERE id = ?',
              [
                title,
                newStartDate,
                newEndDate,
                companyId,
              ]
            );

            connection.end();
            return res.status(200).json({
              status: "approved",
              message: "Assinatura atualizada com sucesso.",
            });
          }
        } else {
          connection.end();
          return res.status(200).json({
            status: "approved",
            message: "Pagamento aprovado, mas é necessário criar a empresa para finalizar.",
          });
        }
      } else {
        const generateRandomPassword = () => {
          return Math.random().toString(36).slice(-8);
        };

        const plainPassword = generateRandomPassword();
        const hashedPassword = await bcrypt.hash(plainPassword, 10);

        await connection.query(
          'INSERT INTO users (full_name, email, cpf, telefone, endereco, cidade, estado, cep, password, company_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [
            userData.full_name.trim(),
            userData.email,
            userData.cpf,
            userData.telefone || null,
            userData.endereco || null,
            userData.cidade || null,
            userData.estado || null,
            userData.cep || null,
            hashedPassword,
            null, 
          ]
        );

        const transporter = nodemailer.createTransport({
          host: 'smtp.hostinger.com',
          port: 465,
          secure: true,
          auth: {
            user: 'contato@conexaocode.com',
            pass: '#Henrique1312',
          },
          tls: {
            rejectUnauthorized: false,
          },
        });

        const mailOptions = {
          from: '"ListaVIp" <contato@conexaocode.com>',
          to: userData.email,
          subject: 'Bem-vindo! Aqui está sua senha',
          html: `
            <!DOCTYPE html>
            <html>
            <head>
              <style>
                body {
                  font-family: Arial, sans-serif;
                  margin: 0;
                  padding: 0;
                  background-color: #f4f4f9;
                  color: #333;
                }
                .container {
                  max-width: 600px;
                  margin: 50px auto;
                  padding: 20px;
                  background-color: #ffffff;
                  border: 1px solid #e0e0e0;
                  border-radius: 10px;
                  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
                  text-align: center;
                }
                .header {
                  background-color: #22252a;
                  color: #f1f1f1;
                  padding: 20px 0;
                  border-top-left-radius: 10px;
                  border-top-right-radius: 10px;
                }
                .header h1 {
                  margin: 0;
                  font-size: 24px;
                  font-weight: bold;
                }
                .content {
                  margin: 20px 0;
                  font-size: 16px;
                  line-height: 1.5;
                }
                .content p {
                  margin: 15px 0;
                }
                .password {
                  font-size: 18px;
                  font-weight: bold;
                  color: #e1ff01;
                  background-color: #22252a;
                  padding: 10px;
                  border-radius: 5px;
                  display: inline-block;
                  margin: 10px 0;
                }
                .footer {
                  font-size: 14px;
                  color: #777;
                  margin-top: 30px;
                  text-align: center;
                }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1>Bem-vindo(a) à ListaVip!</h1>
                </div>
                <div class="content">
                  <p>Olá <strong>${userData.full_name}</strong>,</p>
                  <p>Sua conta foi criada com sucesso!</p>
                  <p>Aqui está sua senha de acesso:</p>
                  <p class="password">${plainPassword}</p>
                  <p>Recomendamos que você altere sua senha após o primeiro login para garantir sua segurança.</p>
                </div>
                <div class="footer">
                  <p>Obrigado por fazer parte da nossa plataforma!</p>
                  <p>Equipe Conexão Code</p>
                </div>
              </div>
            </body>
            </html>
          `,
        };

        transporter.sendMail(mailOptions, (error, info) => {
          if (error) {
            console.error('Erro ao enviar e-mail:', error);
          } 
        });


        await transporter.sendMail(mailOptions);

        connection.end();
        return res.status(200).json({
          status: "approved",
          message: "Pagamento aprovado. Usuário criado. Por favor, finalize a criação da empresa.",
        });
      }
    }

    connection.end();
    return res.status(200).json({
      status: payment.status,
      status_detail: payment.status_detail,
    });
  } catch (error) {
    console.error("Erro ao consultar status do pagamento", error.response?.data || error);
    res.status(500).json({ error: "Erro interno ao consultar status do pagamento." });
  }
});

router.post('/create-company', async (req, res) => {
  const { companyName, userEmail } = req.body;

  if (!companyName || !userEmail) {
    return res.status(400).json({ error: "Nome da empresa e e-mail do usuário são obrigatórios." });
  }

  try {
    const connection = await db.connect();

    const [user] = await connection.query(
      'SELECT * FROM users WHERE email = ?',
      [userEmail]
    );

    if (user.length === 0) {
      connection.end();
      return res.status(404).json({ error: "Usuário não encontrado. Crie o usuário antes de vincular a empresa." });
    }

    const userId = user[0].id;

    const subscriptionStart = new Date();
    const subscriptionEnd = new Date(subscriptionStart);
    subscriptionEnd.setMonth(subscriptionStart.getMonth() + 1);

    const [company] = await connection.query(
      'INSERT INTO companies (fantasy_name, subscription_type, subscription_start, subscription_end, subscription_status) VALUES (?, ?, ?, ?, ?)',
      [
        companyName,
        "basic",
        subscriptionStart,
        subscriptionEnd,
        "active",
      ]
    );

    const companyId = company.insertId;

    await connection.query(
      'UPDATE users SET company_id = ?, role = ? WHERE id = ?',
      [companyId, "ceo", userId]
    );

    connection.end();
    return res.status(200).json({ message: "Empresa criada e vinculada ao usuário com sucesso." });
  } catch (error) {
    console.error("Erro ao criar a empresa:", error);
    res.status(500).json({ error: "Erro interno ao criar a empresa." });
  }
});

module.exports = router;
