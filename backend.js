const express = require('express');
const axios = require('axios');
const app = express();
const PORT = 3000;

app.use(express.json());

const mongoose = require('mongoose');
mongoose.connect('mongodb://localhost:3000/your_database_name');
//Here I did not add database url because I just created the backend part.

const db = mongoose.connection;
db.on('error', console.error.bind(console, 'MongoDB connection error:'));

const transactionSchema = new mongoose.Schema({
    dateOfSale: Date,
    title: String,
    description: String,
    price: Number,
    id: Number,
    category: String,
    image: String,
    sold: Boolean
});
const Transaction = mongoose.model('Transaction', transactionSchema);

app.get('/initialize_database', async (req, res) => {
    try {
        const response = await axios.get('https://s3.amazonaws.com/roxiler.com/product_transaction.json');
        const seedData = response.data;
        
        await Transaction.insertMany(seedData);
        
        res.send("Database initialized with seed data");
    } catch (error) {
        res.status(500).send("Error initializing database");
    }
});

// List Transactions API
app.get('/list_transactions', async (req, res) => {
    try {
        const { month, search_text = '', page = 1, per_page = 10 } = req.query;

        const query = {
            dateOfSale: { $regex: new RegExp(month, 'i') }, 
            $or: [
                { title: { $regex: new RegExp(search_text, 'i') } }, 
                { description: { $regex: new RegExp(search_text, 'i') } }, 
                { price: { $regex: new RegExp(search_text, 'i') } } 
            ]
        };

        const total = await Transaction.countDocuments(query);

        const skip = (page - 1) * per_page;
        const transactions = await Transaction.find(query).skip(skip).limit(per_page);

        res.json({
            total,
            transactions
        });
    } catch (error) {
        console.error('Error listing transactions:', error);
        res.status(500).send("Error listing transactions");
    }
});

// Statistics API
app.get('/statistics', async (req, res) => {
    try {
        const { month } = req.query;

        const startOfMonth = new Date(month);
        startOfMonth.setDate(1); 
        const endOfMonth = new Date(month);
        endOfMonth.setMonth(endOfMonth.getMonth() + 1); 
        
        const transactions = await Transaction.find({
            dateOfSale: {
                $gte: startOfMonth, 
                $lt: endOfMonth 
            }
        });
        
        let totalSaleAmount = 0;
        let totalSoldItems = 0;
        let totalNotSoldItems = 0;

        transactions.forEach(transaction => {
            totalSaleAmount += transaction.price; 
            if (transaction.sold) {
                totalSoldItems++;
            } else {
                totalNotSoldItems++;
            }
        });

        res.json({
            total_sale_amount: totalSaleAmount,
            total_sold_items: totalSoldItems,
            total_not_sold_items: totalNotSoldItems
        });
    } catch (error) {
        console.error('Error calculating statistics:', error);
        res.status(500).send("Error calculating statistics");
    }
});

// Bar Chart API
app.get('/bar_chart', async (req, res) => {
    try {
        const { month } = req.query;

        const priceRanges = [
            { min: 0, max: 100, count: 0 },
            { min: 101, max: 200, count: 0 },
            { min: 201, max: 300, count: 0 },
            { min: 301, max: 400, count: 0 },
            { min: 401, max: 500, count: 0 },
            { min: 501, max: 600, count: 0 },
            { min: 601, max: 700, count: 0 },
            { min: 701, max: 800, count: 0 },
            { min: 801, max: 900, count: 0 },
            { min: 901, max: Number.MAX_SAFE_INTEGER, count: 0 },
        ];

        const startOfMonth = new Date(month);
        startOfMonth.setDate(1); 
        const endOfMonth = new Date(month);
        endOfMonth.setMonth(endOfMonth.getMonth() + 1); 

        const transactions = await Transaction.find({
            dateOfSale: {
                $gte: startOfMonth, 
                $lt: endOfMonth 
            }
        });

        transactions.forEach(transaction => {
            priceRanges.forEach(range => {
                if (transaction.price >= range.min && transaction.price <= range.max) {
                    range.count++;
                }
            });
        });

        const barChartData = priceRanges.map(range => ({
            price_range: `${range.min}-${range.max}`,
            count: range.count
        }));

        res.json(barChartData);
    } catch (error) {
        console.error('Error generating bar chart data:', error);
        res.status(500).send("Error generating bar chart data");
    }
});

// Pie Chart API
app.get('/pie_chart', async (req, res) => {
    try {
        const { month } = req.query;

        const startOfMonth = new Date(month);
        startOfMonth.setDate(1); 
        const endOfMonth = new Date(month);
        endOfMonth.setMonth(endOfMonth.getMonth() + 1); 

        const transactions = await Transaction.find({
            dateOfSale: {
                $gte: startOfMonth, 
                $lt: endOfMonth 
            }
        });

        const categoriesSet = new Set();
        transactions.forEach(transaction => {
            categoriesSet.add(transaction.category); 
        });
        const uniqueCategories = Array.from(categoriesSet);

        const categoryCounts = {};
        transactions.forEach(transaction => {
            if (!categoryCounts[transaction.category]) {
                categoryCounts[transaction.category] = 0;
            }
            categoryCounts[transaction.category]++;
        });

        const pieChartData = uniqueCategories.map(category => ({
            category,
            count: categoryCounts[category] || 0
        }));

        res.json(pieChartData);
    } catch (error) {
        console.error('Error generating pie chart data:', error);
        res.status(500).send("Error generating pie chart data");
    }
});

// Combined Data API
app.get('/combined_data', async (req, res) => {
    try {
        const { month } = req.query;

        const [transactionsResponse, statisticsResponse, barChartResponse, pieChartResponse] = await Promise.all([
            axios.get(`/list_transactions?month=${month}`),
            axios.get(`/statistics?month=${month}`),
            axios.get(`/bar_chart?month=${month}`),
            axios.get(`/pie_chart?month=${month}`)
        ]);

        const combinedData = {
            transactions: transactionsResponse.data,
            statistics: statisticsResponse.data,
            barChart: barChartResponse.data,
            pieChart: pieChartResponse.data
        };

        res.json(combinedData);
    } catch (error) {
        console.error('Error fetching combined data:', error);
        res.status(500).send("Error fetching combined data");
    }
});


app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});