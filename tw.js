///////////////////////////////////////////////////////////////////////////
// sqlite?
///////////////////////////////////////////////////////////////////////////
// === Imports ====
///////////////////////////////////////////////////////////////////////////
const path		= require('path')
///////////////////////////////////////////////////////////////////////////
// === Libraries ====
///////////////////////////////////////////////////////////////////////////
const async 	= require('async')
const sqlite3	= require('sqlite3')
const winston	= require('winston')
const Twitter	= require('twitter')
///////////////////////////////////////////////////////////////////////////
// === Setup: Constants ====
///////////////////////////////////////////////////////////////////////////
const twitter_consumer_key		= 'oUeHpY7Gvgu5S0LdDu7HBLNG5'
const twitter_consumer_secret	= 'HZFKWTBOhXvURif6rQ0Wbj5q6OJs1EdHfmABnlqmkOKIYLK049'
const twitter_access_key		= '2195012198-iJABXvp9Uh3SfFQUPu9W07dqPOKaBosmBNoqDfc'
const twitter_access_secret		= '3Q0Ji0MNZZQt51w7Ai3S0qiZbPbOZCzULZsP6SDZjcqW2'
const twitter_hashtag			= '#liveperson'
const twitter_query_count		= 10
const twitter_lang				= 'ja'
///////////////////////////////////////////////////////////////////////////
// === Setup: Logger ====
///////////////////////////////////////////////////////////////////////////
const { createLogger, format, transports } = winston
const {
	colorize, combine, timestamp, printf
} = format
// eslint-disable-next-line no-shadow
const loggerFormat = printf(({ level, message, timestamp }) => `[${timestamp}] ${level}: ${message}`)
const logger = createLogger({
	level: 'info',
	defaultMeta: { service: 'my-service' },
	format: combine(
		colorize(),
		timestamp(),
		loggerFormat
	),
	transports: [new transports.Console()]
})
///////////////////////////////////////////////////////////////////////////
// === Setup: Twitter ====
///////////////////////////////////////////////////////////////////////////
const T = new Twitter({
	consumer_key: twitter_consumer_key,
	consumer_secret: twitter_consumer_secret,
	access_token_key: twitter_access_key,
	access_token_secret: twitter_access_secret
})
const params = {
	q: twitter_hashtag,
	count: twitter_query_count,
	result_type: 'recent',
	lang: twitter_lang
}
///////////////////////////////////////////////////////////////////////////
// === Setup: Database ====
///////////////////////////////////////////////////////////////////////////
const db = new sqlite3.Database(path.join(__dirname, 'my_db.sqlite'))
///////////////////////////////////////////////////////////////////////////
// === Functions: Database ====
///////////////////////////////////////////////////////////////////////////
function initDb(cb) {
	db.all("select name from sqlite_master where name = 'tweets'", (err, rows) => {
		if (rows.length === 0) {
			logger.info("Database not found. Creating 'tweets' database...")
			db.run("create table tweets (username text, tweet_id text); create unique index tweet_id_idx on tweets(tweet_id)")
		}
		if (err) {
			cb(err)
		} else {
			cb()
		}
	})
}
function existDB(tweet_id, cb) {
	db.get(`select count(1) as cnt from tweets where tweet_id = ?`, tweet_id, (err, row) => {
		if (err) {
			logger.error(err)
			//error handling here
			cb(true)
		} else if (row.cnt > 0) {
			cb(true)
		} else {
			cb(false)
		}
	})
}
function insertDB(username, tweet_id) {
	const stmt = db.prepare("insert into tweets values (?,?)")
	stmt.run(username, tweet_id, (err) => {
		if (err) {
			logger.error(err)
		}
		//error handling here
	})
	stmt.finalize((err) => {
		if (err) {
			logger.error(err)
		}
		//error handling here
	})
}
///////////////////////////////////////////////////////////////////////////
// === Functions: App ====
///////////////////////////////////////////////////////////////////////////
function runMainApp(cb) {
	T.get('search/tweets', params, (err, data) => {
		if (!err) {
			logger.info(`Retrieved ${data.statuses.length} tweets for ${twitter_hashtag}.`)
			for (let i = 0; i < data.statuses.length; i++) {
				const id = { id: data.statuses[i].id_str }
				existDB(data.statuses[i].id_str, (found) => {
					if (!found) {
						// eslint-disable-next-line no-shadow
						T.post('favorites/create', id, (err, response) => {
							if (err) {
								logger.error(err[0].message)
								//additional error handling?
							} else {
								const username = response.user.screen_name
								const tweetId = response.id_str
								insertDB(username, tweetId)
								logger.info(`Favorited: https://twitter.com/${username}/status/${tweetId}`)
							}
						})
					}
				})
			}
		} else {
			logger.error(err[0].message)
			throw new Error(err[0].message)
		}
	})

	//Get all rows:
	/*db.each('select * from tweets', (err, row) => {
		console.log(row)
	})*/

	cb()
}
///////////////////////////////////////////////////////////////////////////
// === Entry ====
///////////////////////////////////////////////////////////////////////////
async.series([
	initDb,
	runMainApp
], (err) => {
	if (err) {
		logger.error(err)
	}
})
