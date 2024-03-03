import http from 'k6/http';
import { check } from 'k6';
// import {query, expected} from "./artist_album_track.js"
// import { query, expected } from './genre.js';
// import {query, expected} from './top_5.js';
import { query, expected } from './album_by_pk.js';

// export let options = {
//     stages: [
//         { duration: '20s', target: 50 },  // Ramp-up to 50 VUs over 20 seconds
//         { duration: '20s', target: 150 }, // Ramp-up to 150 VUs over the next 20 seconds
//         { duration: '20s', target: 300 }, // Ramp-up to 300 VUs over the last 20 seconds
//         // Optional: Add more stages here if you want to include a steady state or ramp-down
//     ],
// };


export let options = {
    scenarios: {
        constant_rps: {
            executor: 'constant-arrival-rate',
            rate: 5000,  // Target RPS
            timeUnit: '1s',
            duration: '5m',
            preAllocatedVUs: 50,  // Number of VUs to pre-allocate
            maxVUs: 100,  // Maximum number of VUs if preAllocatedVUs is not enough
        },
    },
};


// const query = {
//     query: `{
//         artist {
//           ArtistId
//           Name
//           Albums {
//             AlbumId
//             Title
//             Tracks {
//               TrackId
//               Name
//             }
//           }
//         }
//       }
//       `
// };


export default function () {
    const headers = { 'Content-Type': 'application/json' };
    const response = http.post('http://localhost:8000/graphql', JSON.stringify(query), { headers });
    
    check(response, {
        'is status 200': (r) => r.status === 200,
        'is response correct': (r) => JSON.stringify(JSON.parse(r.body)) === JSON.stringify(expected)
    });

    // sleep(1);
};
