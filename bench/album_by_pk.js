export const expected = {
    "data": {
      "albumByAlbumid": {
        "AlbumId": 1,
        "Title": "For Those About To Rock We Salute You"
      }
    }
  };
  
  export const query = {
      query: `{
        albumByAlbumid(AlbumId: 1){
          AlbumId
          Title
        }
      }
        `
  };