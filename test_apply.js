const http = require('http');

const data = JSON.stringify({
    name: "Test User",
    phone: "010-1111-2222",
    address: "Test Address",
    isMember: true,
    selectedSeeds: [1, 2] // 갓 (7->6), 까망가지 (6->5)
});

const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/apply',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
    }
};

const req = http.request(options, (res) => {
    console.log(`STATUS: ${res.statusCode}`);
    res.setEncoding('utf8');
    res.on('data', (chunk) => {
        console.log(`BODY: ${chunk}`);
    });
});

req.on('error', (e) => {
    console.error(`problem with request: ${e.message}`);
});

req.write(data);
req.end();
