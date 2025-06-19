import csrf from 'csurf'; // Use import for csrf
import cookieParser from 'cookie-parser'; // Use import for cookie-parser

const csrfProtection = csrf({ cookie: true }); // No change needed here


module.exports = {
  csrfProtection,
  cookieParser,
};
