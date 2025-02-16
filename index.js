const express = require('express');
const path = require('path');
const app = express();
const port = 3000;
const sqlite3 = require('sqlite3').verbose();

// Connect to SQLite database
let db = new sqlite3.Database('dentistry.db', (err) => {
    if (err) {
        return console.error(err.message);
    }
    console.log('Connected to the SQlite database.');
});

// static resourse & templating engine
app.use(express.static('public'));
// Set EJS as templating engine
app.set('view engine', 'ejs');

app.listen(port, () => {
    console.log(`listening to port ${port}`);
}); 

app.get('/', function (req, res) {
    res.render('home');
});

app.get('/register', function (req, res){
    res.render('register');
});

app.get('/login_get', function (req, res) {
    let formdata = {
        loginType: req.query.loginType,
        username: req.query.username,
        email: req.query.email,
        password: req.query.password
    };

    let sql = "";
    let params = [];

    if (formdata.loginType === "email") {
        sql = "SELECT * FROM users WHERE email = ? AND password = ?";
        params = [formdata.email, formdata.password];
    } else {
        sql = "SELECT * FROM users WHERE username = ? AND password = ?";
        params = [formdata.username, formdata.password];
    }

    db.get(sql, params, (err, user) => {
        if (err) {
            console.error("Database error:", err);
            return res.status(500).json({ status: "error", message: "Server error" });
        }

        if (!user) {
            return res.json({ status: "error", message: "ไม่พบบัญชีผู้ใช้" });
        }

        if (user.password !== formdata.password) {
            return res.json({ status: "error", message: "รหัสผ่านไม่ถูกต้อง" });
        }

        res.json({ status: "success", message: `ล็อกอินสำเร็จด้วย ${formdata.loginType}` });
    });
});


app.get('/registercustomers', function (req, res) {
    res.sendFile(path.join(__dirname, "/home.html"));
});