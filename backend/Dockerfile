FROM node:20-alpine

WORKDIR /app

# OpenSSL (Prisma) + toolchain para compilar addons nativos + Chromium do
# sistema (usado pelo puppeteer-core pra gerar o PDF do catalogo). Alpine usa
# musl libc — o Chromium que o pacote "puppeteer" baixaria sozinho e compilado
# pra glibc e nao roda aqui, por isso instalamos via apk e usamos
# "puppeteer-core" (sem download proprio) apontado pro binario do sistema.
RUN apk add --no-cache openssl python3 make g++ linux-headers chromium

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

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
