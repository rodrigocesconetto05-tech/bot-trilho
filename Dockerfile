FROM node:18-slim

# Instalar dependências necessárias para o Puppeteer
RUN apt-get update && apt-get install -y \
    wget \
    ca-certificates \
    fonts-liberation \
    libappindicator3-1 \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libgdk-pixbuf2.0-0 \
    libnspr4 \
    libnss3 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    libdrm2 \
    libxshmfence1 \
    libgbm1 \
    libxcb-dri3-0 \
    xdg-utils \
    --no-install-recommends \
 && apt-get clean \
 && rm -rf /var/lib/apt/lists/*

# Criar diretório do app
WORKDIR /app

# Copiar os arquivos para o container
COPY . .

# Instalar dependências do projeto
RUN npm install

# Rodar o bot
CMD ["node", "index.js"]

