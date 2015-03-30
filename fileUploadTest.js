var db;

function ab2str(buf) {
  return String.fromCharCode.apply(null, new Uint16Array(buf));
}

function str2ab(str) {
  var buf = new ArrayBuffer(str.length*2); // 2 bytes for each char
  var bufView = new Uint16Array(buf);
  for (var i=0, strLen=str.length; i<strLen; i++) {
    bufView[i] = str.charCodeAt(i);
  }
  return buf;
}

function createDatabase(name) {
    var dbName = name
    var version = 1;
     
    var request = window.indexedDB.open(dbName, version);
    request.onsuccess = function(event) {
        console.log(dbName + " opened at version " + version)
        // Make the database available everywhere in the code.
        db = request.result;
        // Call the showLinks() function to read the database and display the
        // list of links that already exist.
    };
     
    request.onerror = function(event) {
        console.log(request.error + " occurred.");
        console.log(event)
    };
     
    request.onupgradeneeded = function(event) {
        console.log('onupgradeneeded: Current Version: ' + event.oldVersion);
        var result = request.result;
        var objectStore = result.createObjectStore("filesystem", { keyPath: "id" })
    }
} 

window.URL = window.URL || window.webkitURL;

function onFileChange() {
    handleFiles(this.files)
}

function appendToDom(file) {
    var li = document.createElement('li')
    list.appendChild(li)

    var img = document.createElement('img')
    img.src = window.URL.createObjectURL(file)
    img.height = 60
    img.onload = function() {
        window.URL.revokeObjectURL(this.src)
    }

    li.appendChild(img)

    var info = document.createElement('span')
    info.innerHTML = file.name + ": " + file.size + " bytes"

     li.appendChild(info);
}

function handleFiles(files) {
    var fileList = document.getElementById("fileList")

    if (!files.length) {
        fileList.innerHTML = '<p>No files selected</p>'
    } else {
        console.log('running')
        var list = document.createElement('ul')
        fileList.appendChild(list)

        for (var i = 0; i < files.length; i++) {
            var file = files[i]
            
            // appendToDom

            var reader = new FileReader();
            reader.readAsText(file)
            reader.onload = function(e) {
                addFileToSQL(file, e.target.result)
             }
        }
    }
}

function addListeners(fieldname) {
    var inputElement = document.getElementById(fieldname);
    inputElement.addEventListener("change", onFileChange, false);
}

function setupDropBox() {
    var dropbox;

    dropbox = document.getElementById("dropbox");
    dropbox.addEventListener("dragenter", dragenter, false);
    dropbox.addEventListener("dragover", dragover, false);
    dropbox.addEventListener("drop", drop, false);   

    function dragenter(e) {
      e.stopPropagation();
      e.preventDefault();
    }

    function dragover(e) {
      e.stopPropagation();
      e.preventDefault();
    }

    function drop(e) {
      e.stopPropagation();
      e.preventDefault();

      var dt = e.dataTransfer;
      var files = dt.files;

      handleFiles(files);
    }
} 

function fileExtension(filename) {
    var a = filename.split(".");
    if( a.length === 1 || ( a[0] === "" && a.length === 2 ) ) {
        return "";
    }
    return a.pop();
}

function baseName(str) {
   var base = new String(str).substring(str.lastIndexOf('/') + 1); 
    if(base.lastIndexOf(".") != -1)       
        base = base.substring(0, base.lastIndexOf("."));
   return base;
}


window.onload = function() {
    // createDatabase();
    addListeners('input')
    addListeners('inputs')
    setupDropBox();
    //createSQLDatabase()
}

function saveContent(fileContents, fileName) {
    var link = document.createElement('a');
    link.download = fileName;
    link.href = 'data:,' + fileContents;
    link.click();
}

function addFileToSQL(file, fileAsText) {
    window.file = file;
    console.log('add file to sql')
    //file.name, file.size, file.type, file.lastModifiedDate)
     var schemaBuilder = loadSchemaBuilder()
     
    var tlAppDb
    var files

    var fileMD5 = CryptoJS.MD5(fileAsText).toString(CryptoJS.enc.Hex);

    var fileData = {
        'size':             file.size ,
        'md5':              fileMD5,
        'created_at':       new Date(),
        'no_in_filesystem': 1,
        'blob':             str2ab(fileAsText)
     }


     var fileSystemData = {
        'id':                     55,
        'md5':                    fileMD5,
        'original_file_name':     file.name,
        'extension':              fileExtension(file.name),
        'base_name':              baseName(file.name),
        'mime_type':              file.type,
        'original_modified_date': file.lastModifiedDate,
        'created_at':             new Date()
    }

 console.log(file)
 console.log(fileData)
 console.log(fileSystemData)
 console.log('-----------------------')


    schemaBuilder.connect().then(function(db) {

        var schema = db.getSchema()

        var files      = schema.table('Files')
        var filesystem = schema.table('SavedFiles')

        var tx = db.createTransaction()
        window.tx = tx
        console.log(tx.begin)
        
        tx.begin([files, filesystem]).then(function() {
            var row = files.createRow(fileData)
            var q1  = db.insertOrReplace().into(files).values([row])
            return tx.attach(q1)
       }).then(function() {
            return tx.commit()
        }).then(function() {
            console.log('completed')
        })
    })



     // .then(function() {
     //     return tlAppDb.select().from(files).exec()
     // }).then(function(results) {
     //     results.forEach(function(row) {
     //        var contents = ab2str(row.blob)
     //        saveContent(contents, 'imsoawesome.txt')
     //     })
     //  })

}

function loadSchemaBuilder() {
    var schemaBuilder = lf.schema.create('tlapp', 4)

    schemaBuilder.createTable('Files').
                      addColumn('md5',              lf.Type.STRING).
                      addColumn('size',             lf.Type.INTEGER).
                      addColumn('created_at',       lf.Type.DATE_TIME).
                      addColumn('no_in_filesystem', lf.Type.INTEGER).
                      addColumn('blob',             lf.Type.ARRAY_BUFFER).
                      addPrimaryKey(['md5']).
                      addIndex('idx_md5', ['md5'], true)

    schemaBuilder.createTable('SavedFiles').
                      addColumn('id',                     lf.Type.INTEGER).
                      addColumn('md5',                    lf.Type.STRING).
                      addColumn('original_file_name',     lf.Type.STRING).
                      addColumn('extension',              lf.Type.STRING).
                      addColumn('base_name',              lf.Type.STRING).
                      addColumn('mime_type',              lf.Type.STRING).
                      addColumn('original_modified_date', lf.Type.DATE_TIME).
                      addColumn('created_at',             lf.Type.DATE_TIME).
                      addPrimaryKey(['id']).
                      addIndex('idx_saved_files_md5', ['md5'], false)

    return schemaBuilder
}


// FileSystem
// - id                     STRING
// - md5                    STRING
// - original_file_name     STRING
// - extension              STRING
// - base_name              STRING
// - mime_type              STRING
// - original_modified_date DATE
// - user_id                STRING
// - created_at             DATE


// File Parts
// - md5
// - part_blob
// - part_md5
// - size
// - part_no


// Files
// - md5                    STRING
// - size                   INTEGER
// - created_at             DATE
// - modified_at            DATE
// - file                   BLOB
// - no_in_filesystem       INTEGER


