const { log } = require('console');
const express = require('express');
const path = require('path');
const app = express();
const port = 3000;
const sqlite3 = require('sqlite3').verbose();

// Connect to SQLite database
let db = new sqlite3.Database('dental_clinic.db', (err) => {
    if (err) {
        return console.error(err.message);
    }
    console.log('Connected to the SQlite database.');
});

// static resourse & templating engine
app.use(express.static('public'));
// Set EJS as templating engine
app.set('view engine', 'ejs');
app.use(express.json());

app.listen(port, () => {
    console.log(`listening to port ${port}`);
});

app.get('/', function (req, res) {
    res.render('home');
});

app.get('/register', function (req, res) {
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


        const sql2 = 'SELECT * FROM users WHERE username = ' + "'" + params[1] + "'" + ';';
        log(sql2);

        db.all(sql2, [], (err, results) => {  // ใช้ db.all() เพื่อดึงข้อมูลทุกแถว 
            if (err) {
                console.error(err);
                return res.status(500).send("Database error");
            }
            res.render('main', { data: results }); // ส่งข้อมูลไปที่ view
        });
        //res.render('main', { data: user });
        //res.json({ status: "success", message: `ล็อกอินสำเร็จด้วย ${formdata.loginType}` });
    });
});


app.get('/registercustomers', function (req, res) {
    res.render('regcustomers');
});
app.get('/getcustomers', function (req, res) {
    let formdata = {
        first_name: req.query.first_name,
        last_name: req.query.last_name,
        phone: req.query.phone,
        email: req.query.email,
        add: req.query.address,
        dob: req.query.dob,
        gender: req.query.gender
    };
    console.log(formdata);
    let sql = `INSERT INTO customers (first_name, last_name, phone, email, address, dob, gender) 
        VALUES ('${formdata.first_name}', '${formdata.last_name}', '${formdata.phone}', '${formdata.email}',
        '${formdata.add}', '${formdata.dob}', '${formdata.gender}');
    `;
    console.log(sql);
    db.run(sql, (err) => {
        if (err) {
            return console.error('Error inserting data:', err.message);
        }
        console.log('Data inserted successful');
    });
})

app.get('/show', function (req, res) {
    const sql = 'SELECT * FROM customers;';

    db.all(sql, [], (err, results) => {  // ใช้ db.all() เพื่อดึงข้อมูลทุกแถว
        if (err) {
            console.error(err);
            return res.status(500).send("Database error");
        }
        res.render('show', { data: results }); // ส่งข้อมูลไปที่ view
    });
});

app.get('/alert', function (req, res) {
    const sql = 'select * from customers cross join appointments where appointments.customer_id = customers.customer_id;';
    db.all(sql, [], (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).send("Database error");
        }
        res.render('alert', { data: results }); // ส่งข้อมูลไปที่ view
    });
});

app.get('/editcustomers', function (req, res) {
    const sql = 'SELECT * FROM customers;';

    db.all(sql, [], (err, results) => {  // ใช้ db.all() เพื่อดึงข้อมูลทุกแถว
        if (err) {
            console.error(err);
            return res.status(500).send("Database error");
        }
        res.render('editcustomers', { data: results }); // ส่งข้อมูลไปที่ view
    });
});

app.get('/get_edit', function (req, res) {
    //coding
});

app.get('/get_delete', function (req, res) {
    //coding
});

app.get('/viewappointments', function (req, res) {
    const sql = 'SELECT * FROM appointments;';

    db.all(sql, [], (err, results) => {  // ใช้ db.all() เพื่อดึงข้อมูลทุกแถว
        if (err) {
            console.error(err);
            return res.status(500).send("Database error");
        }
        res.render('appointments', { data: results }); // ส่งข้อมูลไปที่ view
    });
});






app.post('/send-notification', (req, res) => {
    console.log("Received Data:", req.body);
    const { customer_id, appointment_id, message } = req.body;
    
    const sql = "INSERT INTO notifications (customer_id, appointment_id, message) VALUES (?, ?, ?)";
    db.all(sql, [customer_id, appointment_id, message], (err, result) => {
        if (err) {
            return res.status(500).json({ success: false, error: err.message });
        }
        res.json({ success: true, message: '📨 แจ้งเตือนสำเร็จ' });
    });
});

app.get('/get-notifications', (req, res) => {
    const sql = "SELECT * FROM notifications ORDER BY created_at DESC";
    db.all(sql, (err, results) => {
        if (err) {
            return res.status(500).json({ success: false, error: err.message });
        }
        res.json(results);
    });
});
