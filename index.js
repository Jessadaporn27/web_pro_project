const express = require('express');
const path = require('path');
const app = express();
const port = 3000;

const conn = require('./dbconn.js');


app.listen(port, () => {
    console.log(`listening to port ${port}`);
}); 

app.get('', function (req, res) {
    res.sendFile(path.join(__dirname, "/home.html"));
});

app.get('/register', function (req, res){
    res.sendFile(path.join(__dirname, "/register.html"));
});

app.get('/login_get', function (req, res) {
    let formdata = {
        loginType: req.query.loginType,
        username: req.query.username,
        email: req.query.email,
        password: req.query.password
    };
    let type = formdata.loginType;
    let sql = "";
    let params = [];
    if (formdata.loginType === "email"){
        sql = "SELECT * FROM users WHERE email = ? AND password = ?";
        params = [formdata.email, formdata.password];
    }
    else{
        sql = "SELECT * FROM users WHERE username = ? AND password = ?";
        params = [formdata.username, formdata.password];
    }
    conn.query(sql, params, (err, result) => {
        if (err) {
            console.error("Database error:", err);
            return res.status(500).json({ status: "error", message: "Server error" });
        }

        if (result.length === 0) {
            return res.json({ status: "error", message: "ไม่พบบัญชีผู้ใช้" });
        }

        let user = result[0];

        if (user.password !== password) {
            return res.json({ status: "error", message: "รหัสผ่านไม่ถูกต้อง" });
        }

        res.json({ status: "success", message: `ล็อกอินสำเร็จด้วย ${loginType}` });
    });
    console.log(type);
})