const { log } = require('console');
const express = require('express');
const path = require('path');
const app = express();
const port = 3000;
const sqlite3 = require('sqlite3').verbose();
const session = require('express-session');

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
app.use(session({ // npm install express-session สำหรับการใช้ 
    secret: 'webpro',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }
}));

app.listen(port, () => {
    console.log(`listening to port ${port}`);
});

app.get('/', function (req, res) {
    res.render('home', { session: req.session || {} });
});

app.get('/register', function (req, res) {
    res.render('register');
});

app.get('/login', function (req, res) {
    res.render('login');
});

app.get('/login_get', function (req, res) {
    let { loginType, username, email, password } = req.query;

    console.log(req.query);
    let sql = "";
    let params = [];

    if (loginType === "email") {
        sql = `
            SELECT users.user_id, users.username, users.role, customers.customer_id 
            FROM users 
            LEFT JOIN customers ON users.user_id = customers.user_id 
            WHERE users.email = ? AND users.password = ?
        `;
        params = [email, password];
    } else {
        sql = `
            SELECT users.user_id, users.username, users.role, customers.customer_id 
            FROM users 
            LEFT JOIN customers ON users.user_id = customers.user_id 
            WHERE users.username = ? AND users.password = ?
        `;
        params = [username, password];
    }
    console.log(`"SQL:"\t${sql}`);
    console.log(`"Params:"\t${params}`);
    db.get(sql, params, (err, user) => {
        if (err) {
            console.error("Database error:", err);
            return res.status(500).json({ status: "error", message: "Server error" });
        }
        console.log(`"User:"\n${user}`);
        if (!user) {
            return res.json({ status: "error", message: "ไม่พบบัญชีผู้ใช้" });
        }

        // **บันทึกข้อมูล user ใน session**
        req.session.user_id = user.user_id;
        req.session.username = user.username;
        req.session.role = user.role;

        if (["admin", "dentist", "employee"].includes(user.role)) {
            req.session.customer_id = null; // Admin ไม่มี customer_id
            return res.redirect('/admin'); // เปลี่ยนไปหน้า admin
        } else {
            req.session.customer_id = user.customer_id; // เก็บ customer_id ถ้ามี
        }

        // ✅ ตรวจสอบว่ามีการแจ้งเตือนใหม่หรือไม่ (เฉพาะลูกค้า)
        if (user.customer_id) {
            const notifSql = "SELECT COUNT(*) AS count FROM notifications WHERE customer_id = ? AND seen = 0";
            db.get(notifSql, [user.customer_id], (err, row) => {
                if (err) {
                    console.error("Error checking notifications:", err);
                    return res.redirect('/');
                }

                req.session.hasNotifications = row.count > 0;  // ✅ ตั้งค่าตัวแปร session
                res.redirect('/');
            });
        } else {
            res.redirect('/'); // Admin ไม่ต้องเช็คแจ้งเตือน
        }
    });
});




app.get('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) return res.status(500).send('Logout error');
        res.redirect('/');
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
    const sql = `SELECT * FROM customers WHERE customer_id = ${req.query.id}`;
    // edit a row based on id
    console.log(sql);
    db.all(sql, (err, rows) => {
        if (err) {
            return console.error(err.message);
        }
        console.log(`success`);
        res.render('edit', { data: rows });
    });
});


app.get('/save', function (req, res) {
    let formdata2 = {
        fname: req.query.fname,
        lname: req.query.lname,
        num: req.query.num,
        email: req.query.email,
        add: req.query.add,
        date: req.query.date,
        gen: req.query.gen,
    };
    const sql = `UPDATE customers SET first_name = '${formdata2.fname}', last_name = '${formdata2.lname}', phone = '${formdata2.num}', address = '${formdata2.add}', dob = '${formdata2.date}', gender = '${formdata2.gen}' WHERE customer_id = ${req.query.id};`;
    // edit a row based on id
    console.log(sql);
    db.run(sql, function (err) {
        if (err) {
            return console.error(err.message);
        }
        console.log(`Row(s) save.`);
    });
});


app.get('/get_delete', function (req, res) {
    const sql = `DELETE FROM customers WHERE customer_id = ${req.query.id}`;
    // delete a row based on id
    console.log(sql);
    db.run(sql, function (err) {
        if (err) {
            return console.error(err.message);
        }
        console.log(`Row(s) deleted.`);
    });
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
    db.run(sql, [customer_id, appointment_id, message], function (err) {
        if (err) {
            return res.status(500).json({ success: false, error: err.message });
        }
        res.json({ success: true, message: '📨 แจ้งเตือนสำเร็จ' });
    });
});

/* app.get('/get-notifications', (req, res) => {
    if (!req.session.user_id) {
        return res.status(403).json({ success: false, message: "กรุณาเข้าสู่ระบบ" });
    }

    const sql = "SELECT * FROM notifications WHERE customer_id = ? ORDER BY created_at DESC";
    db.all(sql, [req.session.user_id], (err, results) => {
        if (err) {
            return res.status(500).json({ success: false, error: err.message });
        }

        // 🔹 อัปเดตสถานะว่าเห็นแล้ว
        const updateSql = "UPDATE notifications SET seen = 1 WHERE customer_id = ?";
        db.run(updateSql, [req.session.user_id]);

        res.json(results);
    });
}); */

app.get('/bill', (req, res) => {
    const customer_id = req.query.customer_id;

    if (!customer_id) {
        return res.status(400).send("ต้องระบุ customer_id");
    }

    db.all(`SELECT * FROM treatment_rec WHERE customer_id = ? ORDER BY date DESC`, [customer_id], (err, rows) => {
        if (err) {
            return res.status(500).send("Error retrieving bills");
        }
        res.render('bill', { bills: rows, customer_id });
    });
});

app.get('/inbox', (req, res) => {
    if (!req.session.user_id || !req.session.customer_id) {
        return res.status(403).send("กรุณาเข้าสู่ระบบก่อน");
    }

    const sql = "SELECT * FROM notifications WHERE customer_id = ? ORDER BY created_at DESC";

    db.all(sql, [req.session.customer_id], (err, messages) => {
        if (err) {
            console.error("Database error:", err);
            return res.status(500).send("เกิดข้อผิดพลาดในระบบ");
        }

        res.render('inbox', { session: req.session, messages });
    });
});

app.post('/mark-as-read', (req, res) => {
    const { id } = req.body;

    if (!id) {
        return res.status(400).json({ success: false, message: "ไม่พบ ID ของข้อความ" });
    }

    const sql = "UPDATE notifications SET seen = 1 WHERE id = ?";

    db.run(sql, [id], function (err) {
        if (err) {
            console.error("Error updating notification:", err);
            return res.status(500).json({ success: false, message: "ไม่สามารถอัปเดตฐานข้อมูล" });
        }

        res.json({ success: true, message: "อัปเดตสำเร็จ" });
    });
});