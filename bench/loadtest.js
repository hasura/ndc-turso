import http from 'k6/http';
import { check } from 'k6';
// import {query, expected} from "./artist_album_track.js"
import { query, expected } from './genre.js';

export let options = {
    stages: [
        { duration: '20s', target: 50 },  // Ramp-up to 50 VUs over 20 seconds
        { duration: '20s', target: 150 }, // Ramp-up to 150 VUs over the next 20 seconds
        { duration: '20s', target: 300 }, // Ramp-up to 300 VUs over the last 20 seconds
        // Optional: Add more stages here if you want to include a steady state or ramp-down
    ],
};


// export let options = {
//     scenarios: {
//         constant_rps: {
//             executor: 'constant-arrival-rate',
//             rate: 300,  // Target RPS
//             timeUnit: '1s',  // 100 iterations per second, adjust as needed
//             duration: '5m',
//             preAllocatedVUs: 50,  // Number of VUs to pre-allocate
//             maxVUs: 100,  // Maximum number of VUs if preAllocatedVUs is not enough
//         },
//     },
// };


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

// const query = {
//   query: `query GetAllArtistsAlbumsAndTracks {
//     artist(limit: 5) {
//       ArtistId
//       Name
//       Albums(limit: 5, where: {AlbumId: {_gt: 1}}) {
//         AlbumId
//         Title
//         Tracks(limit: 5, order_by: {TrackId: Desc}) {
//           TrackId
//           Name
//         }
//       }
//     }
//   }`
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
