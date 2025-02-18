# Usa a imagem oficial do Node.js
FROM node:18-alpine

# Define o diretório de trabalho no container
WORKDIR /app

# Copia os arquivos do package.json e package-lock.json primeiro
COPY package*.json ./

# Instala as dependências de produção
RUN npm install --omit=dev

# Copia todo o código da aplicação para dentro do container
COPY . .

# Define a variável de ambiente do Heroku
ENV PORT=3000

# Expõe a porta que será usada pela aplicação
EXPOSE $PORT

# Comando para rodar a aplicação
CMD ["node", "src/app.js"]
