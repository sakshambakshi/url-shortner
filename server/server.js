const express = require('express');
const volleyball = require('volleyball')
const cors = require('cors');
const mysql = require('mysql');
const ids = require('short-id');
const checkLinks = require('check-links')
const qr = require('qr-image')

ids.configure({
    length: 6,          // The length of the id strings to generate
    algorithm: 'sha1',  // The hashing algoritm to use in generating keys
    salt: Math.random   // A salt value or function
});

const app = express();
const pool = mysql.createPool({
    connectionLimit: 10, //important
    host: 'localhost',
    user: 'root',
    database: 'urlshortner',
    debug: false
});

app.use(cors());
app.use(volleyball);
app.use(express.json())
app.use(express.urlencoded({
    extended: true
}))


app.use('/' , express.static('../client'))
app.post('/url' , async (req ,res ,next)=>{
    // var qr_svg = qr.image('I love QR!', { type: 'png' });
    // qr_svg.pipe(require('fs').createWriteStream('../client/i_love_qr.png'));
    const {url} =  req.body
    const results = await checkLinks([
        url
      ])
      console.log(results[url])
      if(results[url].status == 'dead'){
        return res.send('This url does not seem right');
        
      }
    const today = new Date()
    const date =  today.getFullYear()+'-'+(today.getMonth()+1)+'-'+today.getDate();
    const ID = ids.generate();
    console.log({ID})
    const Insertquery = `INSERT INTO urls( url, created_on , hash) VALUES ('${url}','${date}', '${ID}')`
    const Selectionquery = `SELECT * FROM urls WHERE url = '${url}'`
    const idCheckquery = `SELECT * FROM urls WHERE hash = '${ID}'`
    // res.json({ url, date , query });
    pool.getConnection((err , connection)=>{
        if(err){
            console.log("err@ getting connection")
            next(err)
        }
        connection.query(Selectionquery , (err , rows , fields)=>{
            if(err) {
                connection.release()
                next(err)
            }
            if(rows.length){
                connection.release()
                res.send("Already Exist");
            }
            else if (rows.length == 0 ){
                connection.query(Insertquery , (err , rows , fields)=>{
                    if(err) {
                        connection.release()
                        next(err)
                    }
                    
                    console.log(rows.insertId)
                    connection.query(`SELECT * FROM urls WHERE id = ${rows.insertId} ` , (err , rows) =>{
                        connection.release()
                        const qr_svg = qr.image(url, { type: 'png' });
                        const imgLocation = '../client/'+ID+'.png'
                        console.log(imgLocation)
                         qr_svg.pipe(require('fs').createWriteStream(imgLocation));
                         
                        console.log('http://localhost:5000/${rows[0].hash}')
                        res.send({shortenUrl:`http://localhost:5000/${rows[0].hash}` ,
                                    qrCode: imgLocation
                    });
                    })
                })
            }

        })
        
        
    })
    

})

app.get('/:short' , (req, res) =>{
    console.log(req.params.short);
    pool.getConnection((err , connection) => {
        if(err){
            console.log("error @ /:short pool")
        }
        connection.query(`SELECT * FROM urls WHERE hash = '${req.params.short}'` , (err , rows ) =>{
            if(rows[0]){
                res.redirect(rows[0].url)
        }
        })
    })
})
function notFound(req, res, next) {
  res.status(404);
  const error = new Error('Not Found - ' + req.originalUrl);
  next(error);
}

function errorHandler(err, req, res, next) {
  res.status(res.statusCode || 500);
  res.json({
    message: err.message,
    stack: err.stack
  });
}

app.use(notFound);
app.use(errorHandler);

const port = process.env.PORT || 5000;
app.listen(port, () => {
  console.log('Listening on port', port);
});