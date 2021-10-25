/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 */
define(
[
    'N/file'
],
(
    nFile
) => {
    return {
        onRequest: (context) => {
            try {
                let parameters = context.request.parameters;
                let path = parameters.path;

                let loadedFile = nFile.load({
                    id: path
                });

                let file = nFile.create({
                    name: loadedFile.name,
                    fileType: nFile.Type.PLAINTEXT,
                    folder: loadedFile.folder,
                    contents: parameters.data
                });

                file.save();

                context.response.write(JSON.stringify({status: 'ok'}));
            } catch (e) {
                context.response.write(JSON.stringify({status: 'error', exception: JSON.stringify(e)}));
            }
        }
    }
});