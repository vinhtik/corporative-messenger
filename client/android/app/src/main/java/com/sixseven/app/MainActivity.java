package com.sixseven.app;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebView;

import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.annotation.NonNull;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import com.getcapacitor.BridgeActivity;

import java.util.ArrayList;
import java.util.List;

public class MainActivity extends BridgeActivity {

    private static final int MEDIA_PERMISSION_REQUEST_CODE = 1001;

    private PermissionRequest pendingPermissionRequest;
    private String[] pendingGrantedResources = new String[0];

    private ValueCallback<Uri[]> filePathCallback;
    private ActivityResultLauncher<Intent> fileChooserLauncher;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        fileChooserLauncher = registerForActivityResult(
                new ActivityResultContracts.StartActivityForResult(),
                result -> {
                    if (filePathCallback == null) {
                        return;
                    }

                    Uri[] results = null;

                    try {
                        if (result.getResultCode() == RESULT_OK && result.getData() != null) {
                            results = WebChromeClient.FileChooserParams.parseResult(
                                    result.getResultCode(),
                                    result.getData()
                            );
                        }
                    } catch (Exception error) {
                        error.printStackTrace();
                    }

                    filePathCallback.onReceiveValue(results);
                    filePathCallback = null;
                }
        );

        if (bridge != null && bridge.getWebView() != null) {
            bridge.getWebView().setWebChromeClient(new WebChromeClient() {
                @Override
                public void onPermissionRequest(final PermissionRequest request) {
                    runOnUiThread(() -> handleWebPermissionRequest(request));
                }

                @Override
                public void onPermissionRequestCanceled(PermissionRequest request) {
                    if (pendingPermissionRequest == request) {
                        pendingPermissionRequest = null;
                        pendingGrantedResources = new String[0];
                    }
                }

                @Override
                public boolean onShowFileChooser(
                        WebView webView,
                        ValueCallback<Uri[]> filePathCallbackParam,
                        FileChooserParams fileChooserParams
                ) {
                    if (filePathCallback != null) {
                        filePathCallback.onReceiveValue(null);
                    }

                    filePathCallback = filePathCallbackParam;

                    Intent intent;
                    try {
                        intent = fileChooserParams.createIntent();
                    } catch (Exception e) {
                        filePathCallback = null;
                        return false;
                    }

                    try {
                        fileChooserLauncher.launch(intent);
                    } catch (Exception e) {
                        if (filePathCallback != null) {
                            filePathCallback.onReceiveValue(null);
                            filePathCallback = null;
                        }
                        return false;
                    }

                    return true;
                }
            });
        }
    }

    private void handleWebPermissionRequest(PermissionRequest request) {
        List<String> resourcesToGrant = new ArrayList<>();
        List<String> androidPermissionsToRequest = new ArrayList<>();

        for (String resource : request.getResources()) {
            if (PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(resource)) {
                resourcesToGrant.add(resource);

                if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO)
                        != PackageManager.PERMISSION_GRANTED) {
                    androidPermissionsToRequest.add(Manifest.permission.RECORD_AUDIO);
                }
            } else if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(resource)) {
                resourcesToGrant.add(resource);

                if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA)
                        != PackageManager.PERMISSION_GRANTED) {
                    androidPermissionsToRequest.add(Manifest.permission.CAMERA);
                }
            }
        }

        if (resourcesToGrant.isEmpty()) {
            request.deny();
            return;
        }

        if (androidPermissionsToRequest.isEmpty()) {
            request.grant(resourcesToGrant.toArray(new String[0]));
            return;
        }

        pendingPermissionRequest = request;
        pendingGrantedResources = resourcesToGrant.toArray(new String[0]);

        ActivityCompat.requestPermissions(
                this,
                androidPermissionsToRequest.toArray(new String[0]),
                MEDIA_PERMISSION_REQUEST_CODE
        );
    }

    @Override
    public void onRequestPermissionsResult(
            int requestCode,
            @NonNull String[] permissions,
            @NonNull int[] grantResults
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);

        if (requestCode != MEDIA_PERMISSION_REQUEST_CODE || pendingPermissionRequest == null) {
            return;
        }

        boolean allGranted = true;
        for (int result : grantResults) {
            if (result != PackageManager.PERMISSION_GRANTED) {
                allGranted = false;
                break;
            }
        }

        if (allGranted) {
            pendingPermissionRequest.grant(pendingGrantedResources);
        } else {
            pendingPermissionRequest.deny();
        }

        pendingPermissionRequest = null;
        pendingGrantedResources = new String[0];
    }
}

