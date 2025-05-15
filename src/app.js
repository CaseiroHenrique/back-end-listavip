require('dotenv').config();
const express = require('express');
const app = express();
const cors = require('cors');
const { port, webhookUrl, allowedOrigins } = require('./config');
const { connect } = require('./config/database');
const register = require('./routes/userControl/register');
const login = require('./routes/userControl/login');
const userInfo = require('./routes/userControl/userInfo');
const help = require('./routes/userControl/help');
const logout = require('./routes/userControl/logout');
const reconnect = require('./routes/userControl/reconnect');
const forgot = require('./routes/userControl/forgot');
const reset = require('./routes/userControl/reset');
const PromoterList = require('./routes/promoters/PromoterList');
const PromoterRelatorio = require('./routes/promoters/PromoterRelatorio');
const List = require('./routes/userControl/list');
const CadastroPromoter = require('./routes/promoters/Register');
const ClientesLista = require('./routes/Clientes/ClientesLista');
const gateway = require('./routes/gateway');
const LoginPromoter = require('./routes/promoters/Login');
const ClientesRegistro = require('./routes/Clientes/ClientesRegistro');
const Saldo = require('./routes/Saldo/Saldo');
const uploadRoute = require('./routes/Upload');
const createEventRoute = require('./routes/Eventos/EventoCriar');
const View = require('./routes/View');
const EventoList = require('./routes/Eventos/EventoList');
const EventoRelatorio = require('./routes/Eventos/EventoRelatorios');
const EventoAniversariantes = require('./routes/Eventos/EventoAniversariantes');
const LoginAdmin = require('./routes/Admin/loginAdmin');
const Saques = require('./routes/Admin/saques');
const aprovarSaque = require('./routes/Admin/aprovarSaque');
const Clientes = require('./routes/Admin/Clientes');
const Relatorios = require('./routes/Admin/Relatorios');
const Config = require('./routes/Admin/Config');
const SendEmail = require('./routes/Eventos/SendEmail');
const gatewayTicket = require('./routes/gatewayTicket');
const AniversarioList = require('./routes/Eventos/AniversarioList');

const checkOrigin = (req, res, next) => {
  const origin = req.headers.origin;
  next();
};

async function main() {
  const pool = await connect();

    app.use(cors({
    origin: (origin, callback) => {
      console.log(`→ CORS origin check: ${origin}`);
      if (!origin || allowedOrigins.includes(origin)) {
        console.log(`✔️  Origin autorizada: ${origin}`);
        callback(null, true);
      } else {
        console.log(`❌  Origin bloqueada pelo CORS: ${origin}`);
        callback(new Error('Not allowed by CORS'));
      }
    },
    optionsSuccessStatus: 200
  }));
  app.use(express.json());

  // ─── Servir JSON em /upcoming-events sem precisar de /api ──────────
  app.get('/upcoming-events', async (req, res) => {
    console.log('📣 GET /upcoming-events (root) recebido — query:', req.query);
    const limit = parseInt(req.query.limit, 10) || 3;
    try {
      const [rows] = await pool.query(
        `SELECT
           id,
           event_name      AS title,
           event_description AS description,
           event_image_url AS image,
           event_date,
           event_time
         FROM events
         WHERE event_date >= CURDATE()
         ORDER BY event_date ASC
         LIMIT ?`,
        [limit]
      );
      return res.json({ upcoming: rows });
    } catch (err) {
      console.error('Erro ao buscar upcoming-events root:', err);
      return res.status(500).json({ message: 'Erro interno' });
    }
  });

  // a partir daqui continuam as rotas com /api…
  app.use('/api', checkOrigin, (req, res, next) => {
    req.db = pool;
    next();
  });

  app.use('/api', uploadRoute);
  app.use('/api', register);
  app.use('/api', createEventRoute);
  app.use('/api', EventoAniversariantes);
  app.use('/api', ClientesLista);
  app.use('/api', CadastroPromoter);
  app.use('/api', PromoterList);
  app.use('/api', LoginPromoter);
  app.use('/api', EventoList);
  app.use('/api', login);
  app.use('/api', Saldo);
  app.use('/api', List);
  app.use('/api', userInfo);
  app.use('/api', View);
  app.use('/api', logout);
  app.use('/api', ClientesRegistro);
  app.use('/api', PromoterRelatorio);
  app.use('/api', reconnect);
  app.use('/api', EventoRelatorio);
  app.use('/api', forgot);
  app.use('/api', reset);
  app.use('/api', LoginAdmin);
  app.use('/api', Saques);
  app.use('/api', aprovarSaque);
  app.use('/api', Clientes);
  app.use('/api', Relatorios);
  app.use('/api', Config);
  app.use('/api', SendEmail);
  app.use('/api', gateway);
  app.use('/api', gatewayTicket);
  app.use('/api', help);
  app.use('/api', AniversarioList);

  app.listen(port, async () => {
    console.log(`Servidor rodando na porta ${port}`);
  });
}

main().catch(console.error);
