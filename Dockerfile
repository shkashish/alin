FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build || true
EXPOSE 7860
ENV PORT=7860
CMD ["npm", "start"]
