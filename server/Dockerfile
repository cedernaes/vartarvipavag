FROM node:22
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
EXPOSE 3001
ENV DATA_DIR=/data
CMD ["node", "dist/server.js"]
