require('dotenv').config()
const path = require('path');
const express = require('express');
const session = require('express-session');
const bcrypt = require("bcrypt");
const db = require('./config/db');
const flash = require('connect-flash')

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, "views"));
app.use(express.static(path.join(__dirname, "public")));
app.use(express.urlencoded({ extended: true }));
app.use(express.json())
app.use(session({
    secret: 'this@isjust%arandome$%secrect',
    resave: false,
    saveUninitialized: false
}))

app.use(flash());

function registerUser(username, password, callback) {

    bcrypt.hash(password, 10, function (err, hash) {
        if (err) {
            return callback(err);
        }
        db.query(
            "INSERT INTO users (username, password) VALUES (?, ?)",
            [username, hash],
            function (err, result) {

                if (err) {
                    return callback(err);
                }
                callback(null, result);
            }
        );
    });

}
function loginUser(username, password, callback) {

    db.query(
        "SELECT * FROM users WHERE username = ?",
        [username],
        function (err, rows) {
            if (err) {
                console.log(err);
                return callback(err, null);
            }
            if (rows.length === 0) {
                return callback(null, false);
            }
            const user = rows[0];
            bcrypt.compare(password, user.password, function (err, match) {

                if (err) {
                    console.log(err);
                    return callback(err, null);
                }
                if (!match) {
                    console.log('Wrong Password');
                    return callback(null, false);
                }
                return callback(null, user);
            });
        });
}
function isLogged(req, res, next) {
    if (req.session && req.session.userId) {
        next();
    } else {
        res.redirect('/login');
    }
}

app.get('/', isLogged, (req, res) => {

    const id = req.session.userId
    db.query("SELECT * FROM projects WHERE user_id = ?", [id], (err, projects) => {
        if (err) throw err;
        return res.render('index', { projects })
    });
})

app.get('/register', (req, res) => {
    res.render('register', {
        error: req.flash("error"),
        success: req.flash("success")
    });
});
app.get('/login', (req, res) => {
    res.render('login', {
        error: req.flash("error"),
        success: req.flash("success")
    });
})

app.post('/register', (req, res) => {

    const { username, password } = req.body;

    if (!username || !password) {
        return res.redirect('/register');
    }
    // Register user
    registerUser(username, password, (err, result) => {
        if (err) {
            console.error(err);
            req.flash("error", "Try again");
            return res.redirect('/register');
        }
        // Login user after registration
        loginUser(username, password, (err, user) => {
            if (err) {
                console.error(err);
                req.flash('error', 'Try Again');
                return res.redirect('/login');
            }
            if (!user) {
                return res.redirect('/login');
            }
            req.session.userId = user.id;
            res.redirect('/');
        });
    });

});
app.post('/login', (req, res) => {

    const { username, password } = req.body;
    loginUser(username, password, function (err, user) {
        if (err) {
            console.error(err);
            req.flash('error', 'Try Again');
            return res.redirect('/login');
        }
        if (!user) {
            return res.redirect('/login');
        }
        req.session.userId = user.id;
        res.redirect('/');
    });
});

app.get('/add_project', isLogged, (req, res) => {
    return res.render('add_project', {
        error: req.flash("error"),
        success: req.flash("success")
    });
})
app.post('/add_project', isLogged, (req, res) => {

    const { name, cost, status, due_date } = req.body;
    const user_id = req.session.userId;
    db.query("INSERT INTO projects (name,price,status,due_date,user_id) VALUES(?,?,?,?,?)",
        [name, cost, status, due_date, user_id],
        function (err, result) {
            if (err) {
                req.flash("error", "Try again");
                return res.redirect('/add_project');
            }
            req.flash("success", "Project added");
            return res.redirect('/add_project');
        });
})
app.get('/projects/delete/:id', isLogged, (req, res) => {

    const projectId = req.params.id;
    const userId = req.session.userId;
    db.query(
        "DELETE FROM projects WHERE id = ? AND user_id = ?",
        [projectId, userId],
        (err, result) => {
            if (err) {
                console.error(err);
                return res.redirect('/');
            }
            res.redirect('/');
        });
});

app.get('/projects/edit/:id', isLogged, (req, res) => {

    const projectId = req.params.id;
    const userId = req.session.userId;
    db.query(
        "SELECT * FROM projects WHERE id = ? AND user_id = ?",
        [projectId, userId],
        (err, results) => {
            if (err || results.length === 0) {

                return res.redirect('/');
            }
            res.render('editProject', {
                project: results[0],
                error: req.flash("error"),
                success: req.flash("success")
            });
        });
});
app.post('/projects/edit/:id', isLogged, (req, res) => {

    const projectId = req.params.id;
    const userId = req.session.userId;
    const { name, price, due_date, status } = req.body;
    db.query(
        `UPDATE projects 
         SET name = ?, price = ?, due_date = ?, status = ?
         WHERE id = ? AND user_id = ?`,
        [name, price, due_date, status, projectId, userId],
        (err, result) => {

            if (err) {
                console.error(err);
                req.flash("error", "Try again");
                return res.redirect('back');
            }
            req.flash("success", "Project added");
            res.redirect('/');
        });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});