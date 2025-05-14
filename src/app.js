require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
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
const SendEmail = require('./routes/Eventos/SendEmail');
const AniversarioList = require('./routes/Eventos/AniversarioList');

const LoginAdmin = require('./routes/Admin/loginAdmin');
const Saques = require('./routes/Admin/saques');
const aprovarSaque = require('./routes/Admin/aprovarSaque');
const Clientes = require('./routes/Admin/Clientes');
const Relatorios = require('./routes/Admin/Relatorios');
const Config = require('./routes/Admin/Config');

const gatewayTicket = require('./routes/gatewayTicket');

const app = express();

// Middleware para log de origin (mantido, mas sem uso de 'req' no CORS)
const checkOrigin = (req, res, next) => {
    const origin = req.headers.origin;
    // Aqui você pode fazer algo com 'origin' se quiser
    next();
};

// Serve arquivos estáticos da pasta 'uploads' em '/uploads' e em '/api/uploads'
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/api/uploads', express.static(path.join(__dirname, 'uploads')));

async function main() {
    const pool = await connect();

    // CORS configurado sem usar 'req' no callback
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

    // Disponibiliza pool de conexões via req.db para todas as rotas /api
    app.use('/api', checkOrigin, (req, res, next) => {
        req.db = pool;
        next();
    });

    // Rotas de upload e controle de usuário
    app.use('/api', uploadRoute);
    app.use('/api', register);
    app.use('/api', login);
    app.use('/api', userInfo);
    app.use('/api', help);
    app.use('/api', logout);
    app.use('/api', reconnect);
    app.use('/api', forgot);
    app.use('/api', reset);

    // Rotas de promotores e clientes
    app.use('/api', PromoterList);
    app.use('/api', PromoterRelatorio);
    app.use('/api', CadastroPromoter);
    app.use('/api', LoginPromoter);
    app.use('/api', ClientesLista);
    app.use('/api', ClientesRegistro);

    // Outras rotas de negócio
    app.use('/api', Saldo);
    app.use('/api', List);
    app.use('/api', gateway);
    app.use('/api', gatewayTicket);
    app.use('/api', View);

    // Rotas de eventos
    app.use('/api', createEventRoute);
    app.use('/api', EventoList);
    app.use('/api', EventoRelatorio);
    app.use('/api', EventoAniversariantes);
    app.use('/api', AniversarioList);
    app.use('/api', SendEmail);

    // Rotas de administração
    app.use('/api', LoginAdmin);
    app.use('/api', Saques);
    app.use('/api', aprovarSaque);
    app.use('/api', Clientes);
    app.use('/api', Relatorios);
    app.use('/api', Config);

    app.listen(port, () => {
        console.log(`Servidor rodando na porta ${port}`);
    });
}

main().catch(console.error);
