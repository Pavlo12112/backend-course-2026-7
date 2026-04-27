const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Inventory API",
      version: "1.0.0",
    },
  },
  apis: ["./index.js"],
};

module.exports = swaggerJsdoc(options);