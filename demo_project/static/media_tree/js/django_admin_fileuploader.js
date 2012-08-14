jQuery(function($) {
    DjangoAdminFileUploader = function(o){
        // call parent constructor
        qq.FileUploader.apply(this, arguments);
    
        // this method is completely replaced by showing messages in queue
        // and/or errorlist
        this._options.showMessage = function(message) { };
        
        this._options.originalDocumentTitle = document.title;
        this._options.stats = {
            upload_errors: 0,
            successful_uploads: 0
        }
    }

    qq.extend(DjangoAdminFileUploader.prototype, qq.FileUploader.prototype);

    qq.extend(DjangoAdminFileUploader.prototype, {

        // custom, change-list specific methods --------------------------------

        _updateStatusText: function(id, message, messageClass)
        {
            var row = this._getItemByFileId(id);
            $(row).find('.queue-status').each(function() {
                if (messageClass != null) {
                    $(this).addClass(messageClass);
                }
                $(this).text(message);
            });
        },

        _setQueueMessage: function()
        {
            if (this._filesInProgress > 0) {
                document.title = gettext('uploading… (%i in queue)').replace('%i', this._filesInProgress)+' – '+this._options.originalDocumentTitle;
            } else {
                document.title = this._options.originalDocumentTitle;
            }
            var message = ngettext('%i file in queue.', '%i files in queue.', this._filesInProgress).replace('%i', this._filesInProgress);
            $.addUserMessage(message, 'upload-queue-message');
        },

        _formatSize: function(size) {
            return size > 1000000 ? 
                Math.round(size / 1000000, 1) + ' MB'
                : (size > 1000 ? 
                    Math.round(size / 1000, 1) + ' KB'
                    : size + ' bytes'); 
        },

        _reloadAfterQueueComplete: function() {
            this._setQueueMessage();
            var stats = this._options.stats;
            var self = this;
            if (stats.upload_errors == 0) {
                /*window.location.reload();*/
                // instead, replace change list only:
                var message = gettext('loading…');
                $.addUserMessage(message, 'upload-queue-message');

                $('#changelist').addClass('loading');
                $('#changelist').setUpdateReq($.ajax({
                    url: window.location.href, 
                    success: function(data, textStatus) {
                        stats = self._options.stats;
                        if (self._filesInProgress == 0) {
                            // reload changelist contents
                            $('#changelist').updateChangelist($(data).find('#changelist').html());
                            // insert success message
                            message = ngettext('Successfully added %i file.', 'Successfully added %i files.', stats.successful_uploads).replace('%i', stats.successful_uploads);
                            $.addUserMessage(message, 'upload-queue-message');
                            // reset stats
                            self._options.stats.successful_uploads = 0;
                        }
                    },
                    complete: function(jqXHR, textStatus) {
                        $('#changelist').removeClass('loading');
                    }
                }));
            } else {
                var message = gettext('There were errors during upload.');
                $.addUserMessage(message, 'upload-queue-message');
            }
        },

        // extended methods ----------------------------------------------------

        _onComplete: function(id, fileName, result){
            qq.FileUploaderBasic.prototype._onComplete.apply(this, arguments);

            // mark completed
            var item = this._getItemByFileId(id);                
            qq.remove(this._find(item, 'cancel'));
            
            if (result.success){
                qq.addClass(item, this._classes.success);    
            } else {
                qq.addClass(item, this._classes.fail);
            }         

            if (result.error){
                this._updateStatusText(id, result.error, 'upload-error');
                $(item).find('.upload-progress-bar').text(gettext('failed'));
                this._options.stats.upload_errors++;    
            } else {
                this._options.stats.successful_uploads++;    
            }    
            
            this._setQueueMessage();
            
            if (this._filesInProgress == 0) {
                this._reloadAfterQueueComplete();
            }
        },

        _onProgress: function(id, fileName, loaded, total){
            qq.FileUploaderBasic.prototype._onProgress.apply(this, arguments);

            var row = this._getItemByFileId(id);
            var percent = Math.round(loaded / total * 100);

            $(row).find('.queue-status').text('');
            $(row).find('.upload-progress-bar-container').css('display', 'inline-block');
            var bar = $(row).find('.upload-progress-bar');
            bar.css('width', percent+'%');
            bar.text(percent+'%');
            if (percent == 100) {
                bar.addClass('complete');
            }

            this._setQueueMessage();
        },

        _addToList: function(id, fileName){
            var c = this._options.classes;

            cols = [];
            cols[1] = $(
                '<td class="nowrap"><span style="display: none;" class="upload-progress-bar-container">'
                + '<span class="upload-progress-bar"></span></span><span class="queue-status">' 
                + gettext('queued') + '</span>' 
                + '&nbsp;<a href="#">' + fileName + '</a>'
                + '&nbsp;<a href="#" class="' + c['cancel'] + '">'+gettext('cancel')+'</a>'
                + '</td>');
            cols[2] = $('<td class="filesize"><span class="' + c['size'] + '"></span></td>');

            var row = $.makeChangelistRow(cols, this._getItemByFileId(id))[0];
            row.qqFileId = id;

            var queuedRows = $('tr.queue');

            if (queuedRows.length > 0) {
                $(queuedRows[queuedRows.length - 1]).after(row);
            } else {
                $('#changelist table tbody').prepend(row);
            }

            var sortCol = $('#changelist table').find('th.sorted');
            sortCol.removeClass('sorted ascending descending');
        },

        _getItemByFileId: function(id){
            var item = $('#queue-'+id);
            if (item.length) {
                return item[0];
            } else {
                return $('<tr id="queue-'+id+'" class="queue"></tr>');
            }
        },

        _bindCancelEvent: function() {
            var self = this,
                list = this._listElement;            
            
            qq.attach(list, 'click', function(e){            
                e = e || window.event;
                var target = e.target || e.srcElement;
                
                if (qq.hasClass(target, self._classes.cancel)){                
                    qq.preventDefault(e);
                   
                    // patch: item is not a list item, but a table row, hence is not
                    // the cancel button's parentNode:
                    /* var item = target.parentNode; */
                    var item = $(target).closest('tr')[0];

                    self._handler.cancel(item.qqFileId);
                    qq.remove(item);

                    self._setQueueMessage();
                }
            });
        }    

    });
});
