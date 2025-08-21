const express = require('express');
const path = require('path');
const app = express();
const expressLayouts = require('express-ejs-layouts');

const dashboardRoute = require('./routes/dashboard');
const addLeadRouter = require('./routes/addlead');
const whatsappRoutes = require('./routes/whatsapp');


// ✅ Middleware should come FIRST
app.use(express.json()); // For parsing JSON
app.use(express.urlencoded({ extended: true })); // For parsing form data

// Set up EJS and layouts
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(expressLayouts);

// Static files
app.use(express.static(path.join(__dirname, 'public')));
// ensure static serving (if not already)
app.use('/js', express.static(path.join(__dirname, 'public/js')));

// ✅ Routes (after middleware)
app.use('/', dashboardRoute);
app.use('/dashboard', dashboardRoute);
app.use('/addlead', addLeadRouter);
app.use('/whatsapp', whatsappRoutes);

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});