# Usa a imagem oficial do Node.js
FROM node:18-alpine

# Define o diretório de trabalho no container
WORKDIR /app

# Garante que a pasta de uploads exista antes do runtime
RUN mkdir -p /app/uploads

# Copia os arquivos de dependências e instala
COPY package*.json ./
RUN npm install --omit=dev

# Copia todo o código da aplicação
COPY . .

# Declara /app/uploads como volume persistente
VOLUME ["/app/uploads"]

# Define a variável de ambiente de porta
ENV PORT=3000

# Exponha a porta usada pela aplicação
EXPOSE $PORT

# Comando para iniciar a aplicação
CMD ["node", "src/app.js"]
