const fileUpload = require('express-fileupload');

// Configure express-fileupload middleware
const fileUploadConfig = fileUpload({
  limits: { 
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
  abortOnLimit: true,
  responseOnLimit: "File size limit has been reached",
  useTempFiles: false,
  tempFileDir: '/tmp/',
  createParentPath: true,
  parseNested: true
});

module.exports = fileUploadConfig;