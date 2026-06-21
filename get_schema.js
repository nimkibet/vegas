const url = "https://gtjwctckznenodikmgye.supabase.co/rest/v1/";
const apiKey = "sb_publishable_nenFH56WRAtYgBaXPjrywQ_ExtvVz3a";

fetch(url, {
  headers: {
    "apikey": apiKey,
    "Authorization": `Bearer ${apiKey}`
  }
})
.then(res => res.json())
.then(data => {
  console.log(JSON.stringify(data, null, 2));
})
.catch(err => {
  console.error(err);
});
