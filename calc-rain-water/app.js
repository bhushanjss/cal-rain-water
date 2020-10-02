const axios = require('axios');
const url = 'https://api.worldweatheronline.com/premium/v1/weather.ashx';
let response;
const MONTH_COUNT = 6; //top months for the haviest rainfall
const UNIT_HECTARES = 10000; //sq meters
const UNIT_ACRES = 4046.86; //sq meters
const UNIT_SQ_KM = 1000000;
const UNIT_SQ_MILE = 2589999; //sq meters 
const UNIT_MILE = 1609; //meters
const UNIT_KM = 1000; //meters
const UNIT_FT_DIV = 3.2808; // 1/3.2808 meters
const DAYS_IN_MONTH = [31,28,31,30,31,30,31,31,30,31,30,31];
/**
 *
 * Event doc: https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-lambda-proxy-integrations.html#api-gateway-simple-proxy-for-lambda-input-format
 * @param {Object} event - API Gateway Lambda Proxy Input Format
 *
 * Context doc: https://docs.aws.amazon.com/lambda/latest/dg/nodejs-prog-model-context.html 
 * @param {Object} context
 *
 * Return doc: https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-lambda-proxy-integrations.html
 * @returns {Object} object - API Gateway Lambda Proxy Output Format
 * 
 */
exports.lambdaHandler = async (event, context) => {

    response = {
        'statusCode': 200               
    }

    const corsWhitelist = [
        'https://www.gaiabharat.com',
        'http://localhost:3000'
    ];

    const origin = '';

    if (corsWhitelist.indexOf(origin) !== -1) {
        response.headers = {
            'Access-Control-Allow-Origin': origin          
        }
    }   

    try {
        const queryParams = event['queryStringParameters'] || {};
        let length = queryParams['length'];
        const lengthUnit = queryParams['lengthUnit'] || 'meter';
        let width = queryParams['width'];
        const widthUnit = queryParams['widthUnit'] || 'meter';
        let areaUnit = queryParams['areaUnit'] || 'sqm'; //square meter
        const waterUnit = 'Liters';
        const coord = queryParams['coords'] || '28.6419704,77.2308954';
        let sumAvgRain = 0;

        const config = {
            params: {
                'q': coord,
                'key': '',
                'format': 'json',
                'mca': 'yes',
                'cc': 'no',
                'fx': 'no',
                'show_comments': 'no'
            }
        }
        let area = queryParams['area'];
        let areaSm = 1;
        if(!area) {
            areaUnit = "Sq Meters";
            if(length && width) {
                length = convertUnit(length, lengthUnit);
                width = convertUnit(width, widthUnit);
                area = length * width;
                area = Math.round(area);
            } else {
                area = 1;
            }
            areaSm = area;
        } else {
            areaSm = convertUnitArea(area,areaUnit);
        }
        console.log(`Area: ${areaSm} Sq Meters`); 
        
        const ret = await axios(url, config);
        const climateAverages = ret.data.data.ClimateAverages;
        let months = climateAverages[0] && climateAverages[0].month;

        if(!months[0]) {
            response.body = JSON.stringify({
                message: "Missing weather Data"
            });
        } else {
            const sortedData = calMonsoonMonth(months, 'avgDailyRainfall');        
            const monsoonMonths = sortedData.slice(0,MONTH_COUNT);
            
            for(var i=0; i <monsoonMonths.length; i++) {
                let val = monsoonMonths[i].avgMonthlyRainfall;
                if(!val) {
                    const monthIdx = monsoonMonths[i].index - 1;
                    val = monsoonMonths[i].avgDailyRainfall * DAYS_IN_MONTH[monthIdx];
                }
                const valFl = parseFloat(val);
                sumAvgRain += valFl;
            }
            if(sumAvgRain) {
                const rainUnit = sumAvgRain; //rainfall in mm
                const volWater = areaSm * rainUnit; //Liters
                const volWaterRounded = Math.round(volWater);
                console.log(`Total Unit Rainfall: ${sumAvgRain}`);      
                response.body = JSON.stringify({
                    message: {area, areaUnit, volWaterRounded, waterUnit, length, width, coord, monsoonMonths}
                });
            }
        }        
    } catch (err) {
        if(err.response && err.response.status) {
            response.statusCode = err.response.status;
            response.body = JSON.stringify({
                message : err.response.statusText
            });
        }
        console.log(err);
    }

    return response
};

const calMonsoonMonth = (data, key) => (
     data.sort((a,b) => (
        b[key] - a[key]
    )));

const convertUnitArea = (area, unit) => {
    switch(unit) {
        case 'hectare':
            return area * UNIT_HECTARES;
        case 'acre':
            return area * UNIT_ACRES;
        case 'sqkm':
            return area * UNIT_SQ_KM;
        case 'sqmi':  
            return area * UNIT_SQ_MILE;   
        default:
            return area;
    }
}

const convertUnit = (length, unit) => {
    switch(unit) {
        case 'km':
            return length * UNIT_KM;
        case 'feet':
            return length/UNIT_FT_DIV;
        case 'mile':
            return length * UNIT_MILE;
        default:
            return length;
    }
}