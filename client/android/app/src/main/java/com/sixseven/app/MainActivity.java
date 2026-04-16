package com.sixseven.app;

import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;

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

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

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

