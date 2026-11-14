import fetch from 'node-fetch';
const register = async () => {
  const res = await fetch('http://localhost:4000/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ full_name: 'Test Recruiter', email: 'testlogin@example.com', password: 'Test1234' })
  });
  const data = await res.text();
  console.log('Register status', res.status, data);
};
const login = async () => {
  const res = await fetch('http://localhost:4000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'testlogin@example.com', password: 'Test1234' })
  });
  const data = await res.text();
  console.log('Login status', res.status, data);
};
(async () => {
  await register();
  await login();
})();
