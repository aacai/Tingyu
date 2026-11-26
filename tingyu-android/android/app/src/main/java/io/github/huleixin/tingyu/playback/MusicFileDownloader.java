package io.github.huleixin.tingyu.playback;

import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.media.MediaScannerConnection;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import com.getcapacitor.JSObject;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.URL;
import java.util.Locale;
import java.util.concurrent.TimeUnit;

// android/app/src/main/java/io/github/huleixin/tingyu/playback/MusicFileDownloader.java
// 把 Omni 已解析出的音频 URL 落到公共 Music/听屿；Android 10+ 只经 MediaStore，不硬写 /sdcard。
final class MusicFileDownloader {
    static final String APP_FOLDER = "听屿";
    private static final long TIMEOUT_MS = 10;

    private MusicFileDownloader() {}

    static JSObject download(Context context, String rawUrl, String rawName) throws Exception {
        if (rawUrl == null || rawUrl.length() > 4096) throw new IllegalArgumentException("音频地址无效");
        URL parsed = new URL(rawUrl);
        if (!"http".equals(parsed.getProtocol()) && !"https".equals(parsed.getProtocol())) throw new IllegalArgumentException("音频地址无效");
        String mime = mimeForUrl(parsed.getPath());
        String baseName = sanitize(rawName, "听屿歌曲");
        String fileName = withExtension(baseName, mime);
        okhttp3.OkHttpClient client = new okhttp3.OkHttpClient.Builder()
            .connectTimeout(8, TimeUnit.SECONDS).readTimeout(15, TimeUnit.SECONDS)
            .callTimeout(10, TimeUnit.MINUTES).build();
        okhttp3.Request request = new okhttp3.Request.Builder().url(rawUrl).build();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) return downloadViaMediaStore(context, client, request, fileName, mime);
        return downloadViaFile(context, client, request, fileName, mime);
    }

    private static JSObject downloadViaMediaStore(Context context, okhttp3.OkHttpClient client,
            okhttp3.Request request, String fileName, String mime) throws Exception {
        ContentResolver resolver = context.getContentResolver();
        String relativePath = Environment.DIRECTORY_MUSIC + "/" + APP_FOLDER;
        String displayName = uniqueMediaStoreName(resolver, relativePath, fileName);
        ContentValues pending = new ContentValues();
        pending.put(MediaStore.MediaColumns.DISPLAY_NAME, displayName);
        pending.put(MediaStore.MediaColumns.MIME_TYPE, mime);
        pending.put(MediaStore.MediaColumns.RELATIVE_PATH, relativePath);
        pending.put(MediaStore.MediaColumns.IS_PENDING, 1);
        Uri uri = resolver.insert(MediaStore.Audio.Media.EXTERNAL_CONTENT_URI, pending);
        if (uri == null) throw new IOException("无法创建音乐文件");
        boolean complete = false;
        try {
            try (OutputStream output = resolver.openOutputStream(uri)) {
                if (output == null) throw new IOException("无法打开音乐文件");
                transfer(client, request, output);
            }
            complete = true;
        } finally {
            ContentValues done = new ContentValues();
            done.put(MediaStore.MediaColumns.IS_PENDING, 0);
            resolver.update(uri, done, null, null);
            if (!complete) resolver.delete(uri, null, null);
        }
        return new JSObject().put("uri", uri.toString()).put("displayName", displayName).put("relativePath", relativePath);
    }

    private static JSObject downloadViaFile(Context context, okhttp3.OkHttpClient client,
            okhttp3.Request request, String fileName, String mime) throws Exception {
        if (context.checkSelfPermission(android.Manifest.permission.WRITE_EXTERNAL_STORAGE)
                != android.content.pm.PackageManager.PERMISSION_GRANTED) throw new SecurityException("需要存储权限才能保存到音乐目录");
        File dir = new File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_MUSIC), APP_FOLDER);
        if (!dir.exists() && !dir.mkdirs()) throw new IOException("无法创建音乐目录");
        File file = new File(dir, fileName);
        int suffix = 1;
        String base = fileName;
        int dot = fileName.lastIndexOf('.');
        if (dot > 0) base = fileName.substring(0, dot);
        String ext = dot > 0 ? fileName.substring(dot) : "";
        while (file.exists()) file = new File(dir, base + " (" + suffix++ + ")" + ext);
        try (OutputStream output = new FileOutputStream(file)) {
            transfer(client, request, output);
        }
        MediaScannerConnection.scanFile(context, new String[] { file.getAbsolutePath() }, new String[] { mime }, null);
        return new JSObject().put("uri", Uri.fromFile(file).toString()).put("displayName", file.getName())
            .put("relativePath", Environment.DIRECTORY_MUSIC + "/" + APP_FOLDER);
    }

    private static void transfer(okhttp3.OkHttpClient client, okhttp3.Request request, OutputStream output) throws Exception {
        try (okhttp3.Response response = client.newCall(request).execute()) {
            if (!response.isSuccessful() || response.body() == null) throw new IOException("下载失败 HTTP " + response.code());
            try (InputStream input = response.body().byteStream()) {
                AudioCacheTransfer.drain(input, AudioCacheStore.MAX_FILE, () -> Thread.currentThread().isInterrupted(), bytes -> { });
            }
        }
    }

    private static String uniqueMediaStoreName(ContentResolver resolver, String relativePath, String fileName) {
        String base = fileName;
        int dot = fileName.lastIndexOf('.');
        if (dot > 0) base = fileName.substring(0, dot);
        String ext = dot > 0 ? fileName.substring(dot) : "";
        String candidate = fileName;
        for (int suffix = 1; suffix < 100; suffix++) {
            String[] projection = { MediaStore.MediaColumns._ID };
            String selection = MediaStore.MediaColumns.RELATIVE_PATH + "=? AND " + MediaStore.MediaColumns.DISPLAY_NAME + "=?";
            try (Cursor cursor = resolver.query(MediaStore.Audio.Media.EXTERNAL_CONTENT_URI, projection,
                    selection, new String[] { relativePath, candidate }, null)) {
                if (cursor == null || !cursor.moveToFirst()) return candidate;
            }
            candidate = base + " (" + suffix + ")" + ext;
        }
        return candidate;
    }

    private static String mimeForUrl(String path) {
        String lower = path == null ? "" : path.toLowerCase(Locale.ROOT);
        if (lower.endsWith(".m4a") || lower.endsWith(".mp4")) return "audio/mp4";
        if (lower.endsWith(".flac")) return "audio/flac";
        if (lower.endsWith(".ogg") || lower.endsWith(".opus")) return "audio/ogg";
        if (lower.endsWith(".wav")) return "audio/wav";
        return "audio/mpeg";
    }

    private static String withExtension(String name, String mime) {
        String[] known = { ".mp3", ".m4a", ".flac", ".ogg", ".opus", ".wav", ".aac" };
        for (String ext : known) if (name.toLowerCase(Locale.ROOT).endsWith(ext)) return name;
        switch (mime) {
            case "audio/mp4": return name + ".m4a";
            case "audio/flac": return name + ".flac";
            case "audio/ogg": return name + ".ogg";
            case "audio/wav": return name + ".wav";
            default: return name + ".mp3";
        }
    }

    private static String sanitize(String raw, String fallback) {
        if (raw == null) return fallback;
        String cleaned = raw.replaceAll("[<>:\"/\\\\|?*\\u0000-\\u001F]", "_").replaceAll("\\s+", " ").trim();
        if (cleaned.length() > 120) cleaned = cleaned.substring(0, 120);
        return cleaned.isEmpty() ? fallback : cleaned;
    }
}
