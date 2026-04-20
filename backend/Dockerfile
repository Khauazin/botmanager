FROM node:20-alpine

WORKDIR /app

# Instala OpenSSL (necessário para o Prisma funcionar no Alpine)
RUN apk add --no-cache openssl

# Copia package.json e package-lock.json (se existir)
COPY package*.json ./

# Instala as dependências
RUN npm install

# Copia o schema do prisma
COPY prisma ./prisma/

# Gera o cliente do prisma
RUN npx prisma generate

# Copia o restante do código
COPY . .

EXPOSE 3333

# O docker-compose vai sobrescrever esse comando em desenvolvimento, 
# mas mantemos aqui para produção
CMD ["npm", "start"]
