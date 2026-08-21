const http = require('http');

async function runTests() {
  console.log("1. Verifying frontend /register page");
  const frontendRes = await fetch("http://localhost:3000/register");
  console.log("Frontend /register status:", frontendRes.status);
  
  const email = `test_registration_${Date.now()}@example.com`;
  const password = "password123";

  console.log("\n2. Simulating browser registration fetch");
  let res = await fetch("http://localhost:5000/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      firstName: "Test",
      lastName: "User",
      email,
      password
    })
  });
  
  let body = await res.json();
  console.log("Registration Status:", res.status);
  console.log("Registration Response:", body);
  
  const cookies = res.headers.get("set-cookie") || "";
  console.log("Set-Cookie Header:", cookies);
  
  if (cookies.includes("refreshToken")) {
    console.error("WARNING: Registration should not set refresh token, it should just return 201.");
  }
  
  console.log("\n3. Testing DUPLICATE REGISTRATION");
  let dupRes = await fetch("http://localhost:5000/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      firstName: "Test2",
      lastName: "User2",
      email,
      password
    })
  });
  
  let dupBody = await dupRes.json();
  console.log("Duplicate Registration Status:", dupRes.status);
  console.log("Duplicate Registration Response:", dupBody);
  
  console.log("\n4. Testing LOGIN");
  let loginRes = await fetch("http://localhost:5000/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });
  
  let loginBody = await loginRes.json();
  console.log("Login Status:", loginRes.status);
  
  const loginCookies = loginRes.headers.get("set-cookie") || "";
  console.log("Login Set-Cookie:", loginCookies);
  
  if (!loginCookies.includes("refreshToken") || !loginCookies.includes("HttpOnly")) {
    console.error("ERROR: Missing HttpOnly refresh token!");
  }
  
  const accessToken = loginBody.accessToken;
  console.log("Access Token received in JSON (not cookie):", accessToken ? "YES" : "NO");

  console.log("\n5. Testing PROTECTED API (/auth/me)");
  let meRes = await fetch("http://localhost:5000/api/auth/me", {
    method: "GET",
    headers: { "Authorization": `Bearer ${accessToken}` }
  });
  
  let meBody = await meRes.json();
  console.log("Auth Me Status:", meRes.status);
  console.log("Auth Me Response:", meBody);
  
  console.log("\n6. Testing LOGOUT");
  let logoutRes = await fetch("http://localhost:5000/api/auth/logout", {
    method: "POST",
    headers: { "Authorization": `Bearer ${accessToken}` }
  });
  
  console.log("Logout Status:", logoutRes.status);
  const logoutCookies = logoutRes.headers.get("set-cookie") || "";
  console.log("Logout Set-Cookie:", logoutCookies);
  
}

runTests().catch(console.error);
