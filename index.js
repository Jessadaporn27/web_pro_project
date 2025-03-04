const { log } = require('console');
const express = require('express');
const path = require('path');
const app = express();
const port = 3000;
const sqlite3 = require('sqlite3').verbose();
const session = require('express-session');
const { open } = require("sqlite");
// Connect to SQLite database
let db = new sqlite3.Database('dental_clinic.db', (err) => {
    if (err) {
        return console.error(err.message);
    }
    console.log('Connected to the SQlite database.');
});
async function openDb() {
    return open({
        filename: "dental_clinic.db", // เปลี่ยนเป็น path ฐานข้อมูลของคุณ
        driver: sqlite3.Database,
    });
}
// static resourse & templating engine
app.use(express.static('public'));
// Set EJS as templating engine
app.set('view engine', 'ejs');
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
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
    db.get(sql, params, (err, user) => {
        if (err) {
            console.error("Database error:", err);
            return res.status(500).json({ status: "error", message: "Server error" });
        }
        if (!user) {
            return res.json({ status: "error", message: "ไม่พบบัญชีผู้ใช้" });
        }

        // **บันทึกข้อมูล user ใน session**
        req.session.user_id = user.user_id;
        req.session.username = user.username;
        req.session.role = user.role;

        if (["admin", "dentist", "employee"].includes(user.role)) {
            req.session.customer_id = null; // Admin ไม่มี customer_id
            return res.redirect('/'); // เปลี่ยนไปหน้า admin
        } else {
            req.session.customer_id = user.customer_id;
            const notifSql = "SELECT COUNT(*) AS count FROM notifications WHERE customer_id = ? AND seen = 0";
            db.get(notifSql, [user.customer_id], (err, row) => {
                if (err) {
                    console.error("Error checking notifications:", err);
                    return res.redirect('/');
                }

                req.session.hasNotifications = row.count > 0;  // ✅ ตั้งค่าตัวแปร session
                res.redirect('/');
                console.log(notifSql);
            }); // เก็บ customer_id ถ้ามี
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
    res.render('regcustomers', { session: req.session || {} });
});
app.get('/getcustomers', function (req, res) {
    let formdata = {
        first_name: req.query.first_name,
        last_name: req.query.last_name,
        phone: req.query.phone,
        email: req.query.email,
        add: req.query.address,
        dob: req.query.dob,
        gender: req.query.gender,
        username: req.query.username,
        password: req.query.password
    };
    let usersql = `INSERT INTO users (username, password, role, email)
    VALUES ('${formdata.username}','${formdata.password}','customer','${formdata.email}');`;

    db.run(usersql, (err) => {
        if (err) {
            return console.error('Error inserting data:', err.message);
        }
        console.log('Data inserted successful');

        let selectid = `SELECT user_id FROM users WHERE email = '${formdata.email}';`;

        db.get(selectid, function (err, row) {
            if (err) {
                console.error('Error selecting user_id:', err.message);
                return res.status(500).send('Error selecting user_id');
            }

            if (!row) {
                return res.status(400).send('User ID not found');
            }

            let userid = row.user_id;
            console.log('User ID:', userid);

            // SQL สำหรับเพิ่มข้อมูลใน customers
            let customersql = `INSERT INTO customers (user_id,first_name, last_name, phone, email, address, dob, gender) 
                            VALUES (${userid},'${formdata.first_name}', '${formdata.last_name}', '${formdata.phone}', '${formdata.email}',
                            '${formdata.add}', '${formdata.dob}', '${formdata.gender}');`;

            db.run(customersql,function (err) {
                if (err) {
                    console.error('Error inserting customer:', err.message);
                    return res.status(500).send('Error inserting customer');
                }

                console.log('Customer inserted successfully');
                res.send('Customer registration successful');
            });
        });
    });
});



// app.get('/show', function (req, res) {
//     const sql = 'SELECT * FROM customers;';

//     db.all(sql, [], (err, results) => {  // ใช้ db.all() เพื่อดึงข้อมูลทุกแถว
//         if (err) {
//             console.error(err);
//             return res.status(500).send("Database error");
//         }
//         res.render('show', { data: results }); // ส่งข้อมูลไปที่ view
//     });
// });

app.get('/alert', function (req, res) {
    const sql = `
        SELECT 
            appointments.appointment_id,
            customers.customer_id, 
            customers.first_name, 
            customers.last_name,
            appointments.appointment_date,
            appointments.appointment_time,
            appointments.notes,
            appointments.status,
            CASE 
                WHEN notifications.id IS NOT NULL THEN 1 
                ELSE 0 
            END AS notified
        FROM appointments
        INNER JOIN customers ON appointments.customer_id = customers.customer_id
        LEFT JOIN notifications ON appointments.appointment_id = notifications.appointment_id
    `;

    db.all(sql, [], (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).send("Database error");
        }
        res.render('alert', { data: results, session: req.session || {} });
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
        uid: req.query.uid,
    };
    const sql = `UPDATE customers SET user_id = '${formdata2.uid}', first_name = '${formdata2.fname}', last_name = '${formdata2.lname}', phone = '${formdata2.num}', address = '${formdata2.add}', dob = '${formdata2.date}', gender = '${formdata2.gen}' WHERE customer_id = ${req.query.id};`;
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

app.get('/appointments', function (req, res) {
    const sql = 'SELECT appointment_date FROM appointments;';

    db.all(sql, [], (err, results) => {  // ใช้ db.all() เพื่อดึงข้อมูลทุกแถว
        if (err) {
            console.error(err);
            return res.status(500).send("Database error");
        }
        res.render('regappointments', { data: results }); // ส่งข้อมูลไปที่ view
    });
});

app.get('/bookappointment', function (req, res) {
    let appointmentDate = req.query.date;
    res.render('bookappointments', { date: appointmentDate });
});

app.post('/confirmbooking', function (req, res) {
    let appointmentDate = req.body.appointment_date;
    let sql = `INSERT INTO appointments (appointment_date) VALUES (?);`;

    db.run(sql, [appointmentDate], function (err) {
        if (err) {
            return res.send("Error booking appointment.");
        }
        res.redirect('/appointments'); // กลับไปหน้า appointments
    });
});


app.post('/send-notification', (req, res) => {
    console.log("📩 Received Data:", req.body);

    const { customer_id, appointment_id, message } = req.body;

    if (!customer_id || !appointment_id || !message) {
        console.error("❌ Missing Data", { customer_id, appointment_id, message });
        return res.status(400).json({ success: false, error: "ข้อมูลไม่ครบถ้วน" });
    }

    const sql = `INSERT INTO notifications (customer_id, appointment_id, message) 
                 VALUES (?, ?, ?)`;  

    db.run(sql, [customer_id, appointment_id, message], function (err) {
        if (err) {
            console.error("❌ Database Error:", err.message);
            return res.status(500).json({ success: false, error: err.message });
        }
        console.log("✅ Inserted ID:", this.lastID); // Debug log
        res.json({ success: true, message: '📨 แจ้งเตือนสำเร็จ', inserted_id: this.lastID });
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

app.get('/bills', (req, res) => {
    if (!req.session.user_id || !req.session.customer_id) {
        return res.redirect('/login'); // ถ้ายังไม่ได้ล็อกอิน ให้กลับไปหน้า login
    }

    const sql = `
        SELECT sf.fee_id, sf.treatment_details, sf.amount, tr.treatment_date, sf.payment_status
        FROM service_fees sf
        JOIN treatment_rec tr ON sf.treatment_id = tr.treatment_id
        WHERE sf.customer_id = ?
        ORDER BY tr.treatment_date DESC
    `;

    db.all(sql, [req.session.customer_id], (err, bills) => {
        if (err) {
            console.error("Database error:", err);
            return res.status(500).send("❌ ไม่สามารถดึงข้อมูลใบเสร็จ");
        }

        res.render('bills', { bills ,session: req.session || {} });
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
    console.log("Marking as read:", id);

    const sql = "UPDATE notifications SET seen = 1 WHERE id = ?";
    db.run(sql, [id], function (err) {
        if (err) {
            return res.status(500).json({ success: false, error: err.message });
        }

        // ตรวจสอบจำนวนแจ้งเตือนที่ยังไม่ได้อ่าน
        db.get("SELECT COUNT(*) AS unread FROM notifications WHERE seen = 0", [], (err, row) => {
            if (err) {
                return res.status(500).json({ success: false, error: err.message });
            }

            req.session.hasNotifications = row.unread > 0; // อัปเดต session
            res.json({ success: true, unread: row.unread });
        });
    });
});



app.get('/treatment_records', (req,res) => {
    res.render('treatment_rec');
})

app.get('/savetreatment', function (req, res) {
    let formdata = {
        customer_id: req.query.customer_id,
        dentist_id: req.query.dentist_id,
        diagnosis: req.query.diagnosis,
        FDI: req.query.FDI,
        treatment_details: req.query.treatment_details,
        treatment_date: req.query.treatment_date,
        next_appointment_date: req.query.next_appointment_date
    };
    let sql = `INSERT INTO treatment_rec (customer_id, dentist_id, diagnosis, FDI, treatment_details, treatment_date, next_appointment_date) 
               VALUES (${formdata.customer_id}, ${formdata.dentist_id}, "${formdata.diagnosis}", ${formdata.FDI}, "${formdata.treatment_details}", "${formdata.treatment_date}", "${formdata.next_appointment_date}")`;
    
    console.log(sql);
    db.run(sql, (err) => {
        if (err) {
            return console.error('Error inserting data:', err.message);
        }
        console.log('Data inserted successful');
    });
});
app.get("/treatment-list", async (req, res) => {
    const db = await openDb();
    try {
        const treatments = await db.all(`
            SELECT tr.*, c.first_name, c.last_name 
            FROM treatment_rec tr
            JOIN customers c ON tr.customer_id = c.customer_id
            WHERE tr.treatment_id NOT IN (SELECT treatment_id FROM service_fees)
        `);

        res.render("treatment-list", { treatments });
    } catch (error) {
        console.error("Error fetching treatment data:", error);
        res.status(500).send("เกิดข้อผิดพลาด");
    }
});
/* 
app.get("/create-bill", async (req, res) => {
    const db = await openDb();

    try {
        // ดึงลูกค้าที่มี treatment แต่ยังไม่มีบิลใน service_fees
        const customers = await db.all(`
            SELECT DISTINCT c.*
            FROM customers c
            JOIN treatment_rec t ON c.customer_id = t.customer_id
            LEFT JOIN service_fees s ON t.treatment_id = s.treatment_id
            WHERE s.treatment_id IS NULL;
        `);

        // ดึงเฉพาะรายการ treatment ที่ยังไม่มีบิลใน service_fees
        const treatments = await db.all(`
            SELECT t.*
            FROM treatment_rec t
            LEFT JOIN service_fees s ON t.treatment_id = s.treatment_id
            WHERE s.treatment_id IS NULL;
        `);

        res.render("create-bill", { customers, treatments }); // ✅ ส่ง treatments ไปด้วย
    } catch (error) {
        console.error("❌ Error fetching data:", error);
        res.status(500).send("Internal Server Error");
    }
}); */


app.post("/create-bill", async (req, res) => {
    const { customer_id, treatment_id, treatment_details, amount } = req.body;

    if (!customer_id || !treatment_id || !treatment_details || !amount) {
        return res.status(400).send("❌ กรุณากรอกข้อมูลให้ครบถ้วน");
    }

    const db = await openDb();

    try {
        await db.run(`
            INSERT INTO service_fees (customer_id, treatment_id, treatment_details, amount)
            VALUES (?, ?, ?, ?)
        `, [customer_id, treatment_id, treatment_details, amount]);

        console.log("✅ บันทึกค่ารักษาเรียบร้อย");
        res.redirect("/treatment-list");
    } catch (error) {
        console.error("❌ Error inserting bill:", error);
        res.status(500).send("เกิดข้อผิดพลาด");
    }
});

app.get('/fake-payment/:fee_id', (req, res) => {
    const feeId = req.params.fee_id;

    const sql = `UPDATE service_fees SET payment_status = 'Paid' WHERE fee_id = ?`;
    db.run(sql, [feeId], (err) => {
        if (err) {
            console.error("❌ Error updating payment:", err);
            return res.status(500).send("❌ ไม่สามารถอัปเดตสถานะการชำระเงิน");
        }

        res.redirect('/bills'); // กลับไปที่หน้าบิล
    });
});

app.get('/payment/:fee_id', (req, res) => {
    const feeId = req.params.fee_id;
    res.render('payment', { fee_id: feeId });
});


app.post('/process-payment/:fee_id', (req, res) => {
    const feeId = req.params.fee_id;

    console.log("Fake payment processed:", req.body);

    const sql = `UPDATE service_fees SET payment_status = 'Paid' WHERE fee_id = ?`;
    db.run(sql, [feeId], (err) => {
        if (err) {
            console.error("❌ Error updating payment:", err);
            return res.status(500).send("❌ ไม่สามารถอัปเดตสถานะการชำระเงิน");
        }

        res.redirect('/bills'); // กลับไปหน้าบิล
    });
});

