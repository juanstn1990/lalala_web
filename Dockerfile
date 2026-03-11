FROM node:20-alpine
WORKDIR /app
COPY api/package.json .
RUN npm install
COPY api/server.js .
COPY index.html crear.html /app/public/
COPY images /app/public/images
COPY canciones_muestra /app/public/canciones_muestra
COPY clientes /app/public/clientes
EXPOSE 3001
CMD ["node", "server.js"]
