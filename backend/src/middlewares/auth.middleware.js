const jwt = require('jsonwebtoken');

const middlewareAutenticacao = (req, res, next) => {
  const cabecalhoAuth = req.headers.authorization;

  if (!cabecalhoAuth) {
    return res.status(401).json({ erro: 'Token não fornecido' });
  }

  const [, token] = cabecalhoAuth.split(' ');

  try {
    const decodificado = jwt.verify(token, process.env.JWT_SECRET || 'super_secret_jwt_key_botmanager_2024');
    req.usuarioId = decodificado.id;
    return next();
  } catch (erro) {
    return res.status(401).json({ erro: 'Token inválido' });
  }
};

module.exports = middlewareAutenticacao;
