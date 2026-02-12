const http = require('http');

const newSeedsData = [
    { id: 1, family: "테스트과", name: "테스트씨앗1", quantity: 10 },
    { id: 2, family: "테스트과", name: "테스트씨앗2", quantity: 20 }
];

const data = JSON.stringify(newSeedsData);

const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/seeds',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
    }
};

const req = http.request(options, (res) => {
    console.log(`STATUS: ${res.statusCode}`);
    res.on('data', (chunk) => {
        console.log(`BODY: ${chunk}`);
    });
});

req.on('error', (e) => {
    console.error(`problem with request: ${e.message}`);
});

req.write(data);
req.end();
